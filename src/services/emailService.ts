import { Resend } from 'resend';

export class EmailService {
  private static resend: Resend | null = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  /**
   * Dispatches a memory consolidation score report to the user's email.
   */
  static async sendConsolidationReport(
    email: string,
    displayName: string,
    score: number,
    sleepDurationH: number,
    quality: number
  ) {
    if (!this.resend) {
      console.warn('[EmailService] Resend API Key is missing. Skipping email dispatch.');
      return null;
    }

    try {
      const fromEmail = process.env.EMAIL_FROM || 'NeuroLearn <onboarding@resend.dev>';
      
      const htmlContent = `
        <div style="font-family: sans-serif; background-color: #0b111e; color: #f3f4f6; padding: 40px; border-radius: 12px; max-width: 600px; margin: auto; border: 1px solid #1f2937;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6bd8cb; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.05em;">NEUROLEARN</h1>
            <p style="color: #9ca3af; font-size: 14px; margin-top: 5px;">Cognitive Science Spacing Engine</p>
          </div>
          
          <div style="background: rgba(31, 41, 55, 0.5); padding: 25px; border-radius: 8px; border: 1px solid rgba(107, 216, 203, 0.2); margin-bottom: 25px;">
            <h3 style="margin-top: 0; color: #f3f4f6;">Hello, ${displayName}!</h3>
            <p style="line-height: 1.6; color: #d1d5db;">Your hippocampus successfully consolidated today's active recall study sessions during last night's rest window.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #0f172a; padding: 20px; border-radius: 50%; width: 120px; height: 120px; border: 4px solid #6bd8cb; display: inline-block; text-align: center;">
                <span style="font-size: 36px; font-weight: 800; color: #6bd8cb; line-height: 120px;">${score}</span>
              </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr style="border-bottom: 1px solid #374151;">
                <td style="padding: 10px 0; color: #9ca3af;">Sleep Duration</td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #6bd8cb;">${sleepDurationH.toFixed(1)} Hours</td>
              </tr>
              <tr style="border-bottom: 1px solid #374151;">
                <td style="padding: 10px 0; color: #9ca3af;">Sleep Quality</td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #6bd8cb;">${quality}/5 Quality</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; text-align: center;">
            This email was automatically generated based on your sleep tracking log. To configure email notification settings, visit your Settings Dashboard.
          </p>
          <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #4b5563;">
            &copy; 2026 NeuroLearn Platform. Relational Spaced Spacing.
          </div>
        </div>
      `;

      const response = await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `🧠 Memory Consolidation Report: Score ${score}/100`,
        html: htmlContent,
      });

      console.log('[EmailService] Consolidation report email dispatched successfully:', response.data?.id);
      return response;
    } catch (e) {
      console.error('[EmailService] Failed to dispatch consolidation report:', e);
      return null;
    }
  }
}
