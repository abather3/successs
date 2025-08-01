export declare class EmailService {
    static sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<boolean>;
    private static sendActualEmail;
    static sendWelcomeEmail(email: string, userName: string, temporaryPassword: string): Promise<boolean>;
    private static sendActualWelcomeEmail;
    static sendNotificationEmail(email: string, subject: string, message: string): Promise<boolean>;
}
//# sourceMappingURL=email.d.ts.map