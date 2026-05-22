declare module 'nodemailer' {
  interface Transporter {
    options: { auth?: any };
    sendMail: (mail: any) => Promise<any>;
    close?: () => void;
  }

  export function createTransport(options: any): Transporter;
  export function getTestMessageUrl(info: any): string | undefined;
  export function createTestAccount(): Promise<any>;
  
  const nodemailer: {
    createTransport: typeof createTransport;
    getTestMessageUrl: typeof getTestMessageUrl;
    createTestAccount: typeof createTestAccount;
  };

  export default nodemailer;
}
