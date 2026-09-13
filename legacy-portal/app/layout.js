import "./globals.css";

export const metadata = {
  title: "Legacy Wireless — Field Portal",
  description: "Door-level performance, day over day.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
