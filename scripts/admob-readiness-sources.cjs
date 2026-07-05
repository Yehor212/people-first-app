#!/usr/bin/env node
"use strict";

const ADMOB_READINESS_OFFICIAL_SOURCE_HOSTS = new Set([
  "support.google.com",
  "developers.google.com",
  "developer.android.com",
  "admob.google.com",
]);

const ADMOB_READINESS_APPROVED_SOURCE_URLS = new Set([
  "https://support.google.com/admob/answer/10564477",
  "https://support.google.com/admob/answer/10448801",
  "https://support.google.com/admob/answer/15697162",
  "https://support.google.com/admob/answer/14538460",
  "https://support.google.com/admob/answer/10113207",
  "https://support.google.com/admob/answer/10107561",
  "https://support.google.com/admob/answer/13554116",
  "https://support.google.com/admob/answer/16918505",
  "https://support.google.com/admob/answer/9999955",
  "https://developers.google.com/admob/android/privacy",
  "https://developers.google.com/admob/ios/privacy",
  "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  "https://support.google.com/admob/answer/2772513",
  "https://support.google.com/admob/answer/12835021",
  "https://support.google.com/admob/answer/13030080",
  "https://support.google.com/admob/answer/11601831",
  "https://support.google.com/googleplay/android-developer/answer/9859455",
  "https://support.google.com/admob/answer/7313578",
  "https://admob.google.com/home/resources/best-practices-for-in-app-rewarded-video-ads/",
  "https://support.google.com/admob/answer/7356431",
]);

const ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM = Object.freeze({
  public_app_ads_root: [
    "https://support.google.com/admob/answer/14538460",
  ],
  admob_app_ads_txt_status: [
    "https://support.google.com/admob/answer/14538460",
  ],
  public_google_play_listing: [
    "https://support.google.com/googleplay/android-developer/answer/9859455",
  ],
  public_privacy_policy: [
    "https://support.google.com/googleplay/android-developer/answer/9859455",
    "https://developers.google.com/admob/android/privacy",
    "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  ],
  admob_app_readiness: [
    "https://support.google.com/admob/answer/10564477",
  ],
  admob_policy_center: [
    "https://support.google.com/admob/answer/10448801",
    "https://support.google.com/admob/answer/15697162",
  ],
  privacy_messages_cmp: [
    "https://support.google.com/admob/answer/10113207",
    "https://support.google.com/admob/answer/10107561",
    "https://support.google.com/admob/answer/13554116",
    "https://support.google.com/admob/answer/16918505",
    "https://support.google.com/admob/answer/9999955",
    "https://developers.google.com/admob/android/privacy",
    "https://developers.google.com/admob/ios/privacy",
  ],
  payments_tax_info: [
    "https://support.google.com/admob/answer/2772513",
  ],
  payments_identity_address: [
    "https://support.google.com/admob/answer/13030080",
  ],
  payments_payment_method: [
    "https://support.google.com/admob/answer/12835021",
  ],
  payments_holds: [
    "https://support.google.com/admob/answer/11601831",
  ],
  play_console_ads_data_safety: [
    "https://support.google.com/googleplay/android-developer/answer/9859455",
    "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  ],
  live_ad_playback_device: [
    "https://support.google.com/admob/answer/7313578",
    "https://admob.google.com/home/resources/best-practices-for-in-app-rewarded-video-ads/",
  ],
  full_cross_platform_ad_units: [
    "https://support.google.com/admob/answer/7356431",
  ],
});

module.exports = {
  ADMOB_READINESS_OFFICIAL_SOURCE_HOSTS,
  ADMOB_READINESS_APPROVED_SOURCE_URLS,
  ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM,
};
