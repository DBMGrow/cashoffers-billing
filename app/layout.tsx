import { Inter } from "next/font/google"
import Script from "next/script"
import QueryProvider from "@/providers/QueryProvider"
import "@/styles/globals.css"
import UIProvider from "@/providers/UIProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "CashOffers.PRO",
  description: "All The Offers on Your Client's Homes. All in One Place.",
  icons: { icon: "/icon.png" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <QueryProvider>
          <UIProvider>
            <main className="light">
              <Script id="gtm" strategy="afterInteractive">
                {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','GTM-TN6CWJRZ');`}
              </Script>
              {children}
              <noscript>
                <iframe
                  src="https://www.googletagmanager.com/ns.html?id=GTM-TN6CWJRZ"
                  height="0"
                  width="0"
                  style={{ display: "none", visibility: "hidden" }}
                />
              </noscript>
            </main>
          </UIProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
