"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";

/**
 * Funnel tracking loader.
 *
 * If a GTM container is configured, GTM remains the orchestration layer.
 * Otherwise we load the Google Ads tag directly so conversion measurement
 * works even before a GTM container is created.
 *
 * Declaring `gtag('consent','default',{ad_storage:'denied',...})` is not
 * enough on its own: Google's own tag still reaches pagead2.googlesyndication.com
 * for "cookieless" conversion modeling under a denied Advanced Consent Mode
 * state — a real network contact with an ad server before the visitor has
 * said anything. CNIL treats that contact itself as processing, not just
 * the cookie it would have set, so the tag is not loaded at all until the
 * visitor actually accepts.
 */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GOOGLE_ADS_ID = "AW-18466478982";
const CONSENT_KEY = "gc-revenue-consent-v1";

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

// Same useSyncExternalStore pattern as ConsentBanner's own store: the
// snapshot re-reads localStorage (ConsentBanner writes it before dispatching
// the event, so it is already current by the time this fires), and the
// server snapshot is always false so hydration matches the first paint.
function getConsentSnapshot(): boolean {
  return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

function getServerConsentSnapshot(): boolean {
  return false;
}

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener("gc:consent-changed", onStoreChange);
  return () => window.removeEventListener("gc:consent-changed", onStoreChange);
}

export function Analytics() {
  const granted = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerConsentSnapshot);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULTS }} />

      {granted &&
        (GTM_ID ? (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        ) : (
          <>
            <Script
              id="google-ads-loader"
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-ads-config" strategy="afterInteractive">
              {`gtag('js', new Date());gtag('config', '${GOOGLE_ADS_ID}');`}
            </Script>
          </>
        ))}
    </>
  );
}

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
