import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Gabarito } from "next/font/google";
import "./globals.css";

const display = Gabarito({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Bad(yet)",
  description: "Personal budgeting by pay cutoff",
};

// Sets the saved theme before first paint to avoid a flash. Dark is the default.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("hide")==="1")document.documentElement.dataset.hide="1"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
