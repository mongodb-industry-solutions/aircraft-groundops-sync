import "./globals.css";
import ThemeProvider from "./ThemeProvider";
import { ChatSessionProvider } from "@/context/ChatSessionContext";

export const metadata = {
  title: "Aircraft GroundOps Sync",
  description: "An aviation demo by MongoDB Industry Solutions",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <ChatSessionProvider>{children}</ChatSessionProvider>{" "}
        </ThemeProvider>
      </body>
    </html>
  );
}
