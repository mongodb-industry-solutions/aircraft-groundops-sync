import "./globals.css";
import ThemeProvider from "./ThemeProvider";
import { ChatSessionProvider } from "@/context/ChatSessionContext";
import NavigationBar from "@/components/NavigationBar/NavigationBar";

export const metadata = {
  title: "Aircraft GroundOps Sync",
  description: "An aviation demo by MongoDB Industry Solutions",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <NavigationBar />
          <ChatSessionProvider>{children}</ChatSessionProvider>{" "}
        </ThemeProvider>
      </body>
    </html>
  );
}
