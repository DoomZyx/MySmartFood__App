import {
  WebsiteLayout,
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
} from "@site/WebsiteChrome.jsx";

export function StyledWebsiteLayout() {
  return (
    <WebsiteProviders>
      <WebsiteLayout />
    </WebsiteProviders>
  );
}

export {
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
};
