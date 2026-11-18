import { TrainingService } from '../../core/training/training.service';
import { OpenClawService } from '../open-claw/open-claw.service';
import { Type } from '@google/genai';

export const createSiriusTools = (trainingService: TrainingService, openClawService: OpenClawService) => {
  return [
    {
      name: 'getKnowledgeStats',
      description: 'Lấy thống kê về số lượng đoạn kiến thức (chunks) mà AI đã học được.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
    {
      name: 'searchKnowledge',
      description: 'Tìm kiếm thông tin trong kho tri thức nội bộ. Dùng khi cần thông tin về chính sách, quy định.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Từ khóa tìm kiếm.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'getCurrentTime',
      description: 'Lấy thời gian hiện tại của hệ thống.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
    {
      name: 'create_calendar_event',
      description: 'Tạo một cuộc họp chuyên nghiệp trên Google Calendar (có link Meet).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: 'Tiêu đề cuộc họp' },
          description: { type: Type.STRING, description: 'Mô tả chi tiết' },
          startTime: { type: Type.STRING, description: 'Thời gian bắt đầu (định dạng ISO, vd: 2024-05-10T10:00:00Z)' },
          endTime: { type: Type.STRING, description: 'Thời gian kết thúc (định dạng ISO)' },
          location: { type: Type.STRING, description: 'Địa điểm hoặc link họp' },
          attendees: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Danh sách email người tham gia'
          },
        },
        required: ['summary', 'startTime', 'endTime'],
      },
    },
    {
      name: 'list_calendar_events',
      description: 'Xem danh sách các cuộc họp sắp tới trên lịch.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          maxResults: { type: Type.NUMBER, description: 'Số lượng kết quả tối đa' },
        },
      },
    },
    {
      name: 'send_email',
      description: 'Gửi email xác nhận chuyên nghiệp qua Gmail.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          to: { type: Type.STRING, description: 'Email người nhận' },
          subject: { type: Type.STRING, description: 'Tiêu đề email' },
          meetLink: { type: Type.STRING, description: 'Link Google Meet thật vừa tạo' },
          startTime: { type: Type.STRING, description: 'Thời gian bắt đầu định dạng ISO' },
        },
        required: ['to', 'subject', 'meetLink', 'startTime'],
      },
    },
    {
      name: 'browse_web',
      description: 'Mở trình duyệt Chrome để xem chi tiết trang web.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING, description: 'URL của trang web' },
        },
        required: ['url'],
      },
    },
    {
      name: 'web_action',
      description: 'Thực hiện thao tác trên trình duyệt (click, type, scroll, submit).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ['click', 'type', 'scroll', 'submit'], description: 'Hành động cần làm.' },
          selector: { type: Type.STRING, description: 'CSS Selector của thành phần cần tương tác.' },
          value: { type: Type.STRING, description: 'Giá trị cần nhập.' },
        },
        required: ['action', 'selector'],
      },
    },
  ];
};

export const siriusToolHandlers = {
  getKnowledgeStats: async (trainingService: TrainingService) => {
    const knowledge = await trainingService.listAllKnowledge();
    return { total_chunks: knowledge?.ids?.length || 0 };
  },
  searchKnowledge: async (trainingService: TrainingService, args: { query: string }) => {
    const results = await trainingService.findRelevantContext(args.query, 5);
    return { results };
  },
  getCurrentTime: async () => {
    return { current_time: new Date().toLocaleString('vi-VN') };
  },
  create_calendar_event: async (googleService: any, args: any) => {
    const calendar = googleService.getCalendarClient();
    let startStr = args.startTime;
    let endStr = args.endTime;
    if (!startStr.includes('+') && !startStr.includes('Z')) startStr += '+07:00';
    if (!endStr.includes('+') && !endStr.includes('Z')) endStr += '+07:00';

    const event: any = {
      summary: args.summary,
      location: args.location || 'Trực tuyến (Google Meet)',
      description: args.description || `Cuộc họp được sắp xếp bởi Sirius AI.\n\n--- Thông tin thêm ---\nTrạng thái: Đã xác nhận\nNgười tổ chức: Sirius Assistant`,
      start: { dateTime: startStr, timeZone: 'Asia/Ho_Chi_Minh' },
      end: { dateTime: endStr, timeZone: 'Asia/Ho_Chi_Minh' },
      conferenceData: {
        createRequest: {
          requestId: `sirius-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 15 }, { method: 'email', minutes: 24 * 60 }],
      },
    };

    if (args.attendees && Array.isArray(args.attendees)) {
      event.attendees = args.attendees.map((email: string) => ({ email }));
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all',
      conferenceDataVersion: 1,
    });

    return {
      status: 'success',
      meetLink: response.data.hangoutLink,
      htmlLink: response.data.htmlLink,
      summary: args.summary,
      startTime: startStr,
    };
  },
  list_calendar_events: async (googleService: any, args: any) => {
    const calendar = googleService.getCalendarClient();
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: args.maxResults || 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = response.data.items;
    if (!events || events.length === 0) return 'Không có cuộc họp nào sắp tới.';
    return events.map((e: any) => `- ${e.summary} (${e.start.dateTime || e.start.date})`).join('\n');
  },
  send_email: async (googleService: any, args: any) => {
    const gmail = googleService.getGmailClient();
    const utf8Subject = `=?utf-8?B?${Buffer.from(args.subject).toString('base64')}?=`;
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #02ad64; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Xác Nhận Lịch Họp</h1>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6;">
          <p>Xin chào,</p>
          <p>Sirius AI xin thông báo lịch họp của bạn đã được thiết lập thành công trên hệ thống Google Calendar.</p>
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #02ad64; font-size: 18px;">${args.subject}</h2>
            <p style="margin: 5px 0;"><strong>Thời gian:</strong> ${new Date(args.startTime).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})}</p>
            <p style="margin: 5px 0;"><strong>Hình thức:</strong> Trực tuyến qua Google Meet</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${args.meetLink}" style="background-color: #02ad64; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">THAM GIA CUỘC HỌP</a>
          </div>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          Gửi tự động bởi Sirius AI Assistant.
        </div>
      </div>
    `;

    const messageParts = [
      `From: Sirius AI <me>`,
      `To: ${args.to}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      `Subject: ${utf8Subject}`,
      '',
      htmlBody,
    ];

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
    return `Đã gửi Email xác nhận tới ${args.to}`;
  },
  browse_web: async (openClawService: OpenClawService, args: { url: string }) => {
    await openClawService.navigate(args.url);
    const snapshot = await openClawService.getSnapshot();
    const content = typeof snapshot === 'string' ? snapshot : (snapshot.text || 'Không lấy được nội dung.');
    return { page_content: content.substring(0, 5000), url: args.url };
  },
  web_action: async (openClawService: OpenClawService, args: { action: any, selector: string, value?: string }) => {
    const result = await openClawService.act(args.action, args.selector, args.value);
    const snapshot = await openClawService.getSnapshot();
    const content = typeof snapshot === 'string' ? snapshot : (snapshot.text || 'Đã thực hiện xong.');
    return { status: 'Action performed', result_summary: result, current_page_summary: content.substring(0, 2000) };
  },
};
