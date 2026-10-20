/* Optional visit measurement. Never imported or awaited by the river dashboard. */
(() => {
  try {
    const url = new URL(window.location.href);
    if (url.hostname !== 'jdinneen.github.io' ||
        !['/samish-river-watch/', '/samish-river-watch/index.html'].includes(url.pathname) ||
        url.searchParams.has('fixture') || url.searchParams.has('analytics_off') ||
        navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;

    const id = 'G-C1NDPF5X2M';
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, {
      page_location: url.origin + '/samish-river-watch/',
      page_title: 'Samish River Watch',
      page_referrer: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_prefix: 'srw',
      cookie_path: '/samish-river-watch/',
      cookie_flags: 'SameSite=Lax;Secure'
    });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(tag);
  } catch {
    // Measurement is optional; an unavailable tag must never affect river information.
  }
})();
