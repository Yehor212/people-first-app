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
  "https://support.google.com/admob/answer/14538460",
  "https://support.google.com/admob/answer/10113207",
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
  public_privacy_policy: [
    "https://support.google.com/googleplay/android-developer/answer/9859455",
    "https://developers.google.com/admob/android/privacy",
    "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  ],
  privacy_messages_cmp: [
    "https://support.google.com/admob/answer/10113207",
    "https://support.google.com/admob/answer/13554116",
    "https://support.google.com/admob/answer/16918505",
    "https://support.google.com/admob/answer/9999955",
    "https://developers.google.com/admob/android/privacy",
    "https://developers.google.com/admob/ios/privacy",
  ],
  play_console_ads_data_safety: [
    "https://support.google.com/googleplay/android-developer/answer/9859455",
    "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  ],
});

module.exports = {
  ADMOB_READINESS_OFFICIAL_SOURCE_HOSTS,
  ADMOB_READINESS_APPROVED_SOURCE_URLS,
  ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM,
};
