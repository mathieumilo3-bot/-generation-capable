import Script from "next/script";

/**
 * Google Tag Manager, and only when NEXT_PUBLIC_GTM_ID is set.
 *
 * GTM is the one hook worth hard-coding: `track()` already pushes the funnel
 * events to `window.dataLayer`, which is exactly GTM's input, so GA4, Google
 * Ads conversions and the Meta pixel can all be wired from GTM's interface
 * without another deploy.
 *
 * Consent Mode v2 is initialised denied. Until a consent banner grants it,
 * tags run cookieless — which is what /politique-de-confidentialite states.
 * Granting consent (and therefore dropping advertising cookies) requires a
 * banner and an update to that page; do not flip these defaults without both.
 */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const CONSENT_DEFAULTS = `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'denied',
  functionality_storage:'granted',
  security_storage:'granted',
  wait_for_update:500
});
gtag('set','ads_data_redaction',true);
gtag('set','url_passthrough',true);
`;

export function Analytics() {
  if (!GTM_ID) return null;

  return (
    <>
      {/*
        Consent Mode must be initialised before GTM evaluates any tag, which
        `next/script` cannot guarantee from a layout — so this half stays an
        inline, blocking script. The content is a constant, never user input.
      */}
      <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULTS }} />
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
    </>
  );
}

/** The <noscript> half of the snippet, which must live at the top of <body>. */
export function AnalyticsNoScript() {
  if (!GTM_ID) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
