// Shared filter helpers live in this file so the browser runtime and Node tests use the same parsing logic.
(function (root, factory) {
  const api = factory();

  root.YouTubeFilterCore = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNIT_SECONDS = {
    seconds: 1,
    minutes: 60,
    hours: 3600,
    days: 86400,
    weeks: 604800,
    months: 2629800,
    years: 31557600,
  };

  function normalizeWhitespace(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeTimeUnit(unit) {
    let normalized = normalizeWhitespace(unit).toLowerCase();
    if (!normalized || normalized === 'select') {
      return null;
    }

    if (!normalized.endsWith('s')) {
      normalized += 's';
    }

    return Object.prototype.hasOwnProperty.call(UNIT_SECONDS, normalized)
      ? normalized
      : null;
  }

  // Treat empty or invalid numeric inputs as "filter not set".
  function toOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }

  // Parse compact YouTube counters such as 1.2K, 3.4M, or 2B.
  function parseCompactNumber(text) {
    const normalized = normalizeWhitespace(text)
      .replace(/,/g, '')
      .replace(/\s+/g, '');
    if (!normalized) {
      return null;
    }

    const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/i);
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    const suffix = match[2] ? match[2].toUpperCase() : null;

    if (suffix === 'B') {
      return value * 1000000000;
    }
    if (suffix === 'M') {
      return value * 1000000;
    }
    if (suffix === 'K') {
      return value * 1000;
    }

    return value;
  }

  // Extract a numeric view or watching count from YouTube metadata text.
  function parseViewText(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return null;
    }

    if (/\bno views\b/i.test(normalized)) {
      return 0;
    }

    const match = normalized.match(
      /\b([\d,.]+(?:\.\d+)?\s*[KMB]?)\s+(views?|watching(?:\s+now)?)\b/i
    );
    if (!match) {
      return null;
    }

    return parseCompactNumber(match[1]);
  }

  // Extract relative publish age and convert it to a comparable unit.
  function parseAgeText(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return null;
    }

    const match = normalized.match(
      /(?:streamed\s+)?(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i
    );
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    const unit = normalizeTimeUnit(match[2]);
    if (!unit) {
      return null;
    }

    return {
      value: value,
      unit: unit,
      totalSeconds: value * UNIT_SECONDS[unit],
    };
  }

  // Support both visible timestamp badges and spoken aria-label durations.
  function parseDurationText(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return null;
    }

    if (/\bshorts?\b/i.test(normalized)) {
      return null;
    }

    const match = normalized.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    if (match) {
      return buildDurationFromParts(
        match[1].split(':').map(function (part) {
          return Number(part);
        })
      );
    }

    const hoursMatch = normalized.match(/(\d+)\s+hours?/i);
    const minutesMatch = normalized.match(/(\d+)\s+minutes?/i);
    const secondsMatch = normalized.match(/(\d+)\s+seconds?/i);

    if (!hoursMatch && !minutesMatch && !secondsMatch) {
      return null;
    }

    return buildDuration({
      hours: hoursMatch ? Number(hoursMatch[1]) : 0,
      minutes: minutesMatch ? Number(minutesMatch[1]) : 0,
      seconds: secondsMatch ? Number(secondsMatch[1]) : 0,
    });
  }

  // Convert colon-delimited timestamps into a duration object.
  function buildDurationFromParts(parts) {
    if (
      parts.some(function (part) {
        return Number.isNaN(part);
      })
    ) {
      return null;
    }

    if (parts.length === 2) {
      return buildDuration({
        hours: 0,
        minutes: parts[0],
        seconds: parts[1],
      });
    }

    if (parts.length === 3) {
      return buildDuration({
        hours: parts[0],
        minutes: parts[1],
        seconds: parts[2],
      });
    }

    return null;
  }

  // Normalize duration values and precompute total seconds for comparisons.
  function buildDuration(duration) {
    const hours = duration.hours || 0;
    const minutes = duration.minutes || 0;
    const seconds = duration.seconds || 0;

    return {
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      totalSeconds: hours * 3600 + minutes * 60 + seconds,
    };
  }

  // Strip punctuation and normalize casing before keyword matching.
  function normalizeSearchText(text) {
    return normalizeWhitespace(text)
      .toLowerCase()
      .replace(/[^a-z0-9$%#' ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Split the user input into normalized keyword and phrase filters.
  function normalizeKeywords(rawKeywords) {
    if (!rawKeywords) {
      return [];
    }

    return String(rawKeywords)
      .split(',')
      .map(normalizeSearchText)
      .filter(function (keyword) {
        return keyword.length > 0;
      });
  }

  // Convert raw popup values into the typed shape used by the filter engine.
  function normalizePrefs(rawPrefs) {
    const prefs = rawPrefs || {};
    const minDuration = parseDurationText(prefs.minDurationPref);
    const maxDuration = parseDurationText(prefs.maxDurationPref);

    return {
      minViews: toOptionalNumber(prefs.minPref),
      maxViews: toOptionalNumber(prefs.maxPref),
      maxAgeValue: toOptionalNumber(prefs.timeValuePref),
      maxAgeUnit: normalizeTimeUnit(prefs.timeUnitPref),
      minDurationSeconds: minDuration ? minDuration.totalSeconds : null,
      maxDurationSeconds: maxDuration ? maxDuration.totalSeconds : null,
      keywords: normalizeKeywords(prefs.keywordsPref),
      allowRegularCreator: prefs.regularCreatorPref !== false,
      allowVerifiedCreator: prefs.verifiedCreatorPref !== false,
      allowArtistCreator: prefs.artistCreatorPref !== false,
      requireLive: prefs.livePref === true,
      requireSponsored: prefs.sponsoredPref === true,
      requireMovie: prefs.moviePref === true,
      requirePlaylist: prefs.playlistPref === true,
      requireShorts: prefs.shortsPref === true,
    };
  }

  function isArtistLabel(label) {
    return /official artist channel|\bartist\b/i.test(
      normalizeWhitespace(label)
    );
  }

  function isVerifiedLabel(label) {
    return /\bverified\b/i.test(normalizeWhitespace(label));
  }

  // Prefer explicit badge labels, then fall back to a regular creator when channel metadata exists.
  function classifyCreatorType(labels, hasCreatorContext) {
    const normalizedLabels = Array.isArray(labels) ? labels : [];

    if (normalizedLabels.some(isArtistLabel)) {
      return 'artist';
    }

    if (normalizedLabels.some(isVerifiedLabel)) {
      return 'verified';
    }

    return hasCreatorContext ? 'regular' : null;
  }

  // Only treat explicit live-video cues as live to avoid false positives from channel text.
  function detectLiveFlag(labels, metadataTexts, hasCardContext, hasDuration) {
    const texts = []
      .concat(Array.isArray(labels) ? labels : [])
      .concat(Array.isArray(metadataTexts) ? metadataTexts : [])
      .map(normalizeWhitespace)
      .filter(function (text) {
        return text.length > 0;
      });

    if (
      texts.some(function (text) {
        return (
          /^live(?:\s+now)?$/i.test(text) ||
          /\b\d[\d,.]*\s*[KMB]?\s+watching(?:\s+now)?\b/i.test(text)
        );
      })
    ) {
      return true;
    }

    if (hasDuration || hasCardContext) {
      return false;
    }

    return null;
  }

  // Detect sponsored videos from the labels YouTube exposes on the card.
  function detectSponsoredFlag(labels, metadataTexts, hasCardContext) {
    const haystack = []
      .concat(Array.isArray(labels) ? labels : [])
      .concat(Array.isArray(metadataTexts) ? metadataTexts : [])
      .join(' ');

    if (/\bsponsored\b|\bpaid promotion\b/i.test(haystack)) {
      return true;
    }

    if (hasCardContext) {
      return false;
    }

    return null;
  }

  // Detect movie cards from explicit YouTube labels and movie/storefront links.
  function detectMovieFlag(
    labels,
    metadataTexts,
    linkUrls,
    rendererNames,
    hasCardContext
  ) {
    const texts = []
      .concat(Array.isArray(labels) ? labels : [])
      .concat(Array.isArray(metadataTexts) ? metadataTexts : [])
      .map(normalizeWhitespace)
      .filter(function (text) {
        return text.length > 0;
      });
    const urls = Array.isArray(linkUrls) ? linkUrls : [];
    const renderers = Array.isArray(rendererNames) ? rendererNames : [];

    if (
      texts.some(isMovieSignal) ||
      urls.some(isMovieUrl) ||
      renderers.some(isMovieRenderer)
    ) {
      return true;
    }

    if (hasCardContext) {
      return false;
    }

    return null;
  }

  function isMovieSignal(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    const movieLabels = [
      'movie',
      'movies',
      'movies & tv',
      'movies and tv',
      'youtube movies',
      'free with ads',
      'buy or rent',
      'rent or buy',
      'available to buy',
      'available to rent',
      'purchased',
    ];

    if (movieLabels.indexOf(normalized) !== -1) {
      return true;
    }

    return /\b(?:buy|rent)\b.*\bmovie\b|\bmovie\b.*\b(?:buy|rent)\b/i.test(
      normalized
    );
  }

  function isMovieUrl(url) {
    const normalized = normalizeWhitespace(url).toLowerCase();

    return (
      /\/(?:feed\/)?storefront\b/.test(normalized) ||
      /\/movies\b/.test(normalized)
    );
  }

  function isMovieRenderer(rendererName) {
    return /\bmovie\b/i.test(normalizeWhitespace(rendererName));
  }

  // Detect playlist cards from explicit YouTube labels, playlist links, and renderers.
  function detectPlaylistFlag(
    labels,
    metadataTexts,
    linkUrls,
    rendererNames,
    hasCardContext
  ) {
    const texts = []
      .concat(Array.isArray(labels) ? labels : [])
      .concat(Array.isArray(metadataTexts) ? metadataTexts : [])
      .map(normalizeWhitespace)
      .filter(function (text) {
        return text.length > 0;
      });
    const urls = Array.isArray(linkUrls) ? linkUrls : [];
    const renderers = Array.isArray(rendererNames) ? rendererNames : [];

    if (
      texts.some(isPlaylistSignal) ||
      urls.some(isPlaylistUrl) ||
      renderers.some(isPlaylistRenderer)
    ) {
      return true;
    }

    if (hasCardContext) {
      return false;
    }

    return null;
  }

  function isPlaylistSignal(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    const playlistLabels = [
      'playlist',
      'playlists',
      'full playlist',
      'view playlist',
      'view full playlist',
      'watch full playlist',
      'created playlist',
      'official playlist',
    ];

    if (playlistLabels.indexOf(normalized) !== -1) {
      return true;
    }

    return /\bplaylist\b.*\b\d+\s+videos?\b|\b\d+\s+videos?\b.*\bplaylist\b/i.test(
      normalized
    );
  }

  function isPlaylistUrl(url) {
    return /\/playlist(?:\?|$)/i.test(normalizeWhitespace(url));
  }

  function isPlaylistRenderer(rendererName) {
    const normalized = normalizeWhitespace(rendererName).toLowerCase();
    const playlistRenderers = [
      'ytd-playlist-renderer',
      'ytd-grid-playlist-renderer',
      'ytd-rich-grid-playlist-renderer',
    ];

    return playlistRenderers.indexOf(normalized) !== -1;
  }

  // Detect Shorts cards from explicit YouTube labels, Shorts links, and renderers.
  function detectShortsFlag(
    labels,
    metadataTexts,
    linkUrls,
    rendererNames,
    hasCardContext
  ) {
    const texts = []
      .concat(Array.isArray(labels) ? labels : [])
      .concat(Array.isArray(metadataTexts) ? metadataTexts : [])
      .map(normalizeWhitespace)
      .filter(function (text) {
        return text.length > 0;
      });
    const urls = Array.isArray(linkUrls) ? linkUrls : [];
    const renderers = Array.isArray(rendererNames) ? rendererNames : [];

    if (
      texts.some(isShortsSignal) ||
      urls.some(isShortsUrl) ||
      renderers.some(isShortsRenderer)
    ) {
      return true;
    }

    if (hasCardContext) {
      return false;
    }

    return null;
  }

  function isShortsSignal(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    const shortsLabels = ['shorts', 'youtube shorts', 'watch shorts'];

    return shortsLabels.indexOf(normalized) !== -1;
  }

  function isShortsUrl(url) {
    return /\/shorts\//i.test(normalizeWhitespace(url));
  }

  function isShortsRenderer(rendererName) {
    const normalized = normalizeWhitespace(rendererName).toLowerCase();
    const shortsRenderers = [
      'ytd-reel-item-renderer',
      'ytd-reel-video-renderer',
      'ytm-shorts-lockup-view-model',
      'yt-shorts-lockup-view-model',
    ];

    return shortsRenderers.indexOf(normalized) !== -1;
  }

  function hasCreatorFilter(prefs) {
    return !(
      prefs.allowRegularCreator &&
      prefs.allowVerifiedCreator &&
      prefs.allowArtistCreator
    );
  }

  function hasDurationFilter(prefs) {
    return (
      prefs.minDurationSeconds !== null || prefs.maxDurationSeconds !== null
    );
  }

  function hasViewFilter(prefs) {
    return prefs.minViews !== null || prefs.maxViews !== null;
  }

  function hasAgeFilter(prefs) {
    return prefs.maxAgeValue !== null && prefs.maxAgeUnit !== null;
  }

  function hasKeywordFilter(prefs) {
    return Array.isArray(prefs.keywords) && prefs.keywords.length > 0;
  }

  function hasFeatureFilter(prefs) {
    return (
      prefs.requireLive ||
      prefs.requireSponsored ||
      prefs.requireMovie ||
      prefs.requirePlaylist ||
      prefs.requireShorts
    );
  }

  function titleMatchesKeyword(normalizedTitle, keyword) {
    return (' ' + normalizedTitle + ' ').includes(' ' + keyword + ' ');
  }

  // Evaluate one video's extracted metadata against the active filter set.
  function evaluateVideo(videoMeta, prefs) {
    const meta = videoMeta || {};
    const normalizedTitle = normalizeSearchText(meta.title || '');
    const reasons = [];

    if (hasViewFilter(prefs)) {
      if (typeof meta.views !== 'number') {
        reasons.push('views');
      } else {
        if (prefs.minViews !== null && meta.views < prefs.minViews) {
          reasons.push('views');
        }
        if (prefs.maxViews !== null && meta.views > prefs.maxViews) {
          reasons.push('views');
        }
      }
    }

    if (hasAgeFilter(prefs)) {
      if (!meta.age || typeof meta.age.totalSeconds !== 'number') {
        reasons.push('age');
      } else if (
        meta.age.totalSeconds >
        prefs.maxAgeValue * UNIT_SECONDS[prefs.maxAgeUnit]
      ) {
        reasons.push('age');
      }
    }

    if (hasDurationFilter(prefs)) {
      if (typeof meta.durationSeconds !== 'number') {
        reasons.push('duration');
      } else {
        if (
          prefs.minDurationSeconds !== null &&
          meta.durationSeconds < prefs.minDurationSeconds
        ) {
          reasons.push('duration');
        }
        if (
          prefs.maxDurationSeconds !== null &&
          meta.durationSeconds > prefs.maxDurationSeconds
        ) {
          reasons.push('duration');
        }
      }
    }

    if (hasKeywordFilter(prefs)) {
      if (!normalizedTitle) {
        reasons.push('keywords');
      } else if (
        !prefs.keywords.some(function (keyword) {
          return titleMatchesKeyword(normalizedTitle, keyword);
        })
      ) {
        reasons.push('keywords');
      }
    }

    if (hasCreatorFilter(prefs)) {
      if (!meta.creatorType) {
        reasons.push('creator');
      } else if (
        (meta.creatorType === 'regular' && !prefs.allowRegularCreator) ||
        (meta.creatorType === 'verified' && !prefs.allowVerifiedCreator) ||
        (meta.creatorType === 'artist' && !prefs.allowArtistCreator)
      ) {
        reasons.push('creator');
      }
    }

    if (hasFeatureFilter(prefs)) {
      const selectedFeatures = [];

      if (prefs.requireLive) {
        selectedFeatures.push(meta.isLive === true);
      }
      if (prefs.requireSponsored) {
        selectedFeatures.push(meta.isSponsored === true);
      }
      if (prefs.requireMovie) {
        selectedFeatures.push(meta.isMovie === true);
      }
      if (prefs.requirePlaylist) {
        selectedFeatures.push(meta.isPlaylist === true);
      }
      if (prefs.requireShorts) {
        selectedFeatures.push(meta.isShorts === true);
      }

      const passes = selectedFeatures.some(function (selectedFeature) {
        return selectedFeature;
      });

      if (!passes) {
        reasons.push('features');
      }
    }

    return {
      shouldHide: reasons.length > 0,
      reasons: reasons,
    };
  }

  // Export the pure helpers so browser code and Node tests stay in sync.
  return {
    UNIT_SECONDS: UNIT_SECONDS,
    normalizeWhitespace: normalizeWhitespace,
    normalizeTimeUnit: normalizeTimeUnit,
    normalizeSearchText: normalizeSearchText,
    normalizePrefs: normalizePrefs,
    parseCompactNumber: parseCompactNumber,
    parseViewText: parseViewText,
    parseAgeText: parseAgeText,
    parseDurationText: parseDurationText,
    classifyCreatorType: classifyCreatorType,
    detectLiveFlag: detectLiveFlag,
    detectSponsoredFlag: detectSponsoredFlag,
    detectMovieFlag: detectMovieFlag,
    detectPlaylistFlag: detectPlaylistFlag,
    detectShortsFlag: detectShortsFlag,
    evaluateVideo: evaluateVideo,
  };
});

// Bootstrap the Chrome extension runtime only when the page and extension APIs are available.
(function () {
  'use strict';

  const FilterCore = globalThis.YouTubeFilterCore;
  if (
    !FilterCore ||
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    typeof document === 'undefined'
  ) {
    return;
  }

  // Persist the popup filters in session storage so the popup and content script stay aligned.
  const STORAGE_KEYS = [
    'minPref',
    'maxPref',
    'timeValuePref',
    'timeUnitPref',
    'minDurationPref',
    'maxDurationPref',
    'keywordsPref',
    'regularCreatorPref',
    'verifiedCreatorPref',
    'artistCreatorPref',
    'livePref',
    'sponsoredPref',
    'moviePref',
    'playlistPref',
    'shortsPref',
  ];
  // Selector lists cover both legacy YouTube renderers and the newer lockup view-model markup.
  const VIDEO_RENDERER_SELECTOR =
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-playlist-renderer, ytd-reel-item-renderer';
  const FEED_CONTAINER_SELECTORS = [
    'ytd-rich-grid-renderer #contents',
    'ytd-two-column-browse-results-renderer ytd-rich-grid-renderer #contents',
  ];
  const TITLE_SELECTORS = [
    '#video-title',
    '#video-title-link',
    'a#video-title-link',
    'yt-formatted-string#video-title',
    'yt-lockup-metadata-view-model h3 a',
    'yt-lockup-view-model a[href*="/watch"]',
    'a.yt-lockup-view-model-wiz__title',
    'h3 a[href*="/watch"]',
    'a[title][href*="/watch"]',
  ];
  const METADATA_SELECTORS = [
    '#metadata-line span',
    '#metadata-line yt-formatted-string',
    'ytd-video-meta-block span',
    '#details span',
    '#details yt-formatted-string',
    '#byline-container span',
    '#byline span',
    'yt-content-metadata-view-model span',
    'yt-content-metadata-view-model div',
  ];
  const METADATA_ATTRIBUTE_SELECTORS = ['a#thumbnail', 'a#video-title-link'];
  const DURATION_TEXT_SELECTORS = [
    '#time-status #text',
    '#time-status span',
    'ytd-thumbnail-overlay-time-status-renderer #text',
    'ytd-thumbnail-overlay-time-status-renderer span',
    'ytd-thumbnail-overlay-time-status-renderer yt-formatted-string',
    'badge-shape span',
    'badge-shape div',
    'badge-shape .yt-badge-shape__text',
    'yt-thumbnail-badge-view-model span',
    'yt-thumbnail-badge-view-model div',
    'yt-thumbnail-badge-view-model .yt-badge-shape__text',
  ];
  const DURATION_ATTRIBUTE_SELECTORS = [
    'ytd-thumbnail-overlay-time-status-renderer',
    'ytd-thumbnail-overlay-time-status-renderer [aria-label]',
    'badge-shape',
    'badge-shape [aria-label]',
    'yt-thumbnail-badge-view-model',
    'yt-thumbnail-badge-view-model [aria-label]',
  ];
  const FEATURE_BADGE_SELECTORS = [
    '#badges span',
    '#badges yt-formatted-string',
    '#badges [aria-label]',
    'div.badge',
    'ytd-badge-supported-renderer',
    'ytd-badge-supported-renderer [aria-label]',
    'badge-shape',
    'badge-shape [aria-label]',
    'yt-thumbnail-badge-view-model',
    'yt-thumbnail-badge-view-model [aria-label]',
    'ytd-thumbnail-overlay-time-status-renderer',
    'ytd-thumbnail-overlay-time-status-renderer [aria-label]',
  ];
  const MOVIE_LINK_SELECTORS = [
    'a[href*="/movies"]',
    'a[href*="/feed/storefront"]',
  ];
  const PLAYLIST_LINK_SELECTORS = ['a[href^="/playlist"]'];
  const SHORTS_LINK_SELECTORS = ['a[href*="/shorts/"]'];
  const CREATOR_BADGE_SELECTORS = [
    'ytd-author-badge-renderer',
    'ytd-author-badge-renderer [aria-label]',
    'ytd-channel-name [aria-label]',
    'ytd-channel-name yt-icon',
    'yt-content-metadata-view-model [aria-label]',
    'yt-content-metadata-view-model yt-icon',
    'yt-lockup-metadata-view-model [aria-label]',
    'yt-lockup-metadata-view-model yt-icon',
  ];
  const CREATOR_METADATA_ROOT_SELECTORS = [
    'yt-content-metadata-view-model',
    'yt-lockup-metadata-view-model',
    'ytd-channel-name',
  ];
  const CREATOR_ICON_SELECTORS = [
    '.yt-core-attributed-string__image-element',
    '.ytIconWrapperHost[role="img"]',
    'ytd-author-badge-renderer',
    'ytd-author-badge-renderer [aria-label]',
    'yt-icon',
  ];
  const CREATOR_CONTEXT_SELECTOR = [
    '#channel-name',
    'ytd-channel-name',
    '#byline-container',
    '#byline',
    'yt-content-metadata-view-model',
    'yt-lockup-metadata-view-model',
    'a[href^="/@"]',
    'a[href^="/channel/"]',
    'a[href^="/c/"]',
    'a[href^="/user/"]',
  ].join(', ');

  // Track the current filter state and the active observer for the current feed container.
  const state = {
    prefs: FilterCore.normalizePrefs({}),
    observer: null,
    observedRoot: null,
  };

  // Timers debounce SPA navigation and retry attaching when the feed has not rendered yet.
  let refreshTimer = null;
  let retryTimer = null;

  // Enable session-storage access, restore saved prefs, and start observing the feed.
  setSessionAccessLevel();
  installNavigationListeners();
  loadPrefs(function () {
    applyFilters();
    refreshObserver();
  });

  // Apply popup updates immediately when the user clicks Apply.
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (!request || request.message !== 'newPrefs') {
        return;
      }

      updatePrefs(request.prefs || {});
      sendResponse({ status: 'ok' });
    }
  );

  // Allow the content script to read the popup's session-stored preferences.
  function setSessionAccessLevel() {
    try {
      if (
        chrome.storage &&
        chrome.storage.session &&
        chrome.storage.session.setAccessLevel
      ) {
        chrome.storage.session.setAccessLevel({
          accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
        });
      }
    } catch {
      return;
    }
  }

  // YouTube is a SPA, so listen for in-page navigations instead of full page loads.
  function installNavigationListeners() {
    document.addEventListener('yt-navigate-finish', handleNavigation);
    document.addEventListener('yt-page-data-updated', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
  }

  // Defer reattachment slightly to give YouTube time to render the new feed container.
  function handleNavigation() {
    scheduleObserverRefresh(300);
  }

  // Restore the last-applied popup settings when the content script starts.
  function loadPrefs(callback) {
    if (!chrome.storage || !chrome.storage.session) {
      callback();
      return;
    }

    chrome.storage.session.get(STORAGE_KEYS, function (result) {
      state.prefs = FilterCore.normalizePrefs(result || {});
      callback();
    });
  }

  // Normalize, persist, and apply new preferences sent from the popup.
  function updatePrefs(rawPrefs) {
    state.prefs = FilterCore.normalizePrefs(rawPrefs);

    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.set(rawPrefs);
    }

    applyFilters();
    scheduleObserverRefresh(0);
  }

  // Debounce observer refreshes during rapid SPA updates.
  function scheduleObserverRefresh(delay = 300) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshObserver, delay);
  }

  // Retry until the feed container appears on the page.
  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(refreshObserver, 1000);
  }

  // Stop any pending retry once the feed is available.
  function clearRetry() {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  // Locate the current homepage or subscriptions feed container.
  function findFeedContainer() {
    for (let i = 0; i < FEED_CONTAINER_SELECTORS.length; i += 1) {
      const container = document.querySelector(FEED_CONTAINER_SELECTORS[i]);
      if (container) {
        return container;
      }
    }

    return null;
  }

  // Rebind the mutation observer when YouTube swaps out the feed container.
  function refreshObserver() {
    const nextRoot = findFeedContainer();

    if (!nextRoot) {
      disconnectObserver();
      scheduleRetry();
      return;
    }

    clearRetry();

    if (nextRoot !== state.observedRoot) {
      disconnectObserver();
      state.observer = new MutationObserver(handleMutations);
      state.observer.observe(nextRoot, {
        childList: true,
        subtree: true,
      });
      state.observedRoot = nextRoot;
    }

    applyFiltersToCards(getVideoCards(nextRoot));
  }

  // Clean up the previous observer before rebinding to a new feed.
  function disconnectObserver() {
    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = null;
    state.observedRoot = null;
  }

  // Refilter only the cards added by the latest mutation batch.
  function handleMutations(mutationList) {
    const cards = collectCardsFromMutations(mutationList);
    if (cards.length === 0) {
      return;
    }

    applyFiltersToCards(cards);
  }

  // Pull matching video-card containers out of nested mutation payloads.
  function collectCardsFromMutations(mutationList) {
    const cards = new Set();

    mutationList.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (!(node instanceof Element)) {
          return;
        }

        if (node.matches(VIDEO_RENDERER_SELECTOR)) {
          cards.add(node);
        }

        node.querySelectorAll(VIDEO_RENDERER_SELECTOR).forEach(function (card) {
          cards.add(card);
        });
      });
    });

    return Array.from(cards);
  }

  // Return all filterable video cards within the current feed container.
  function getVideoCards(root) {
    return Array.from(root.querySelectorAll(VIDEO_RENDERER_SELECTOR));
  }

  // Refilter the current feed using the latest preference state.
  function applyFilters() {
    const root = state.observedRoot || findFeedContainer();
    if (!root) {
      return;
    }

    applyFiltersToCards(getVideoCards(root));
  }

  // Apply the active filters to each card in a collection.
  function applyFiltersToCards(cards) {
    cards.forEach(function (card) {
      applyFilterToCard(card);
    });
  }

  // Hide or show a single card based on its extracted metadata.
  function applyFilterToCard(card) {
    const decision = FilterCore.evaluateVideo(
      extractVideoMeta(card),
      state.prefs
    );

    if (decision.shouldHide) {
      card.style.display = 'none';
    } else {
      card.style.removeProperty('display');
    }
  }

  // Gather all metadata needed by the filter engine from one card.
  function extractVideoMeta(card) {
    const title = getTitle(card);
    const metadataTexts = mergeUniqueTexts(
      collectCandidateTexts(card, METADATA_SELECTORS),
      collectAttributeTexts(card, METADATA_ATTRIBUTE_SELECTORS, [
        'aria-label',
        'title',
      ])
    );
    const duration = extractDuration(card);
    const featureLabels = collectCandidateTexts(card, FEATURE_BADGE_SELECTORS);
    const movieLinks = collectAttributeTexts(card, MOVIE_LINK_SELECTORS, [
      'href',
    ]);
    const playlistLinks = collectAttributeTexts(card, PLAYLIST_LINK_SELECTORS, [
      'href',
    ]);
    const shortsLinks = collectAttributeTexts(card, SHORTS_LINK_SELECTORS, [
      'href',
    ]);
    const rendererNames = collectRendererNames(card);
    const creatorBadgeLabels = collectCandidateTexts(
      card,
      CREATOR_BADGE_SELECTORS
    );
    const creatorLabels = extractCreatorLabels(card, creatorBadgeLabels);
    const hasCreatorContext = Boolean(
      card.querySelector(CREATOR_CONTEXT_SELECTOR)
    );
    const hasCardContext = Boolean(
      title ||
      metadataTexts.length > 0 ||
      featureLabels.length > 0 ||
      creatorLabels.length > 0 ||
      duration
    );

    return {
      views: firstParsedValue(metadataTexts, FilterCore.parseViewText),
      age: firstParsedValue(metadataTexts, FilterCore.parseAgeText),
      durationSeconds: duration ? duration.totalSeconds : null,
      title: title,
      creatorType: FilterCore.classifyCreatorType(
        creatorLabels,
        hasCreatorContext
      ),
      isLive: FilterCore.detectLiveFlag(
        featureLabels,
        metadataTexts,
        hasCardContext,
        Boolean(duration)
      ),
      isSponsored: FilterCore.detectSponsoredFlag(
        featureLabels,
        metadataTexts,
        hasCardContext
      ),
      isMovie: FilterCore.detectMovieFlag(
        featureLabels,
        metadataTexts,
        movieLinks,
        rendererNames,
        hasCardContext
      ),
      isPlaylist: FilterCore.detectPlaylistFlag(
        featureLabels,
        metadataTexts,
        playlistLinks,
        rendererNames,
        hasCardContext
      ),
      isShorts: FilterCore.detectShortsFlag(
        featureLabels,
        metadataTexts,
        shortsLinks,
        rendererNames,
        hasCardContext
      ),
    };
  }

  // Capture custom feature renderer names without title matching.
  function collectRendererNames(card) {
    const rendererNames = [];
    const seen = new Set();

    pushRendererName(rendererNames, seen, card);
    card.querySelectorAll('*').forEach(function (element) {
      pushRendererName(rendererNames, seen, element);
    });

    return rendererNames;
  }

  function pushRendererName(rendererNames, seen, element) {
    if (!element || !element.localName || seen.has(element.localName)) {
      return;
    }

    seen.add(element.localName);
    rendererNames.push(element.localName);
  }

  // Read duration from visible overlay text or accessibility labels.
  function extractDuration(card) {
    const durationTexts = mergeUniqueTexts(
      collectCandidateTexts(card, DURATION_TEXT_SELECTORS),
      collectAttributeTexts(card, DURATION_ATTRIBUTE_SELECTORS, [
        'aria-label',
        'title',
      ])
    );

    return firstParsedValue(durationTexts, FilterCore.parseDurationText);
  }

  // Derive creator badge labels from creator metadata markup and fallback icon signals.
  function extractCreatorLabels(card, badgeLabels) {
    const creatorLabels = Array.isArray(badgeLabels) ? badgeLabels.slice() : [];
    const creatorRoots = getCreatorRoots(card);
    const creatorHtml = creatorRoots
      .map(function (root) {
        return root.innerHTML || '';
      })
      .join(' ');
    const hasCreatorIcon = creatorRoots.some(function (root) {
      return root.querySelector(CREATOR_ICON_SELECTORS.join(', '));
    });
    const hasOfficialArtistMarkup =
      /official_artist_badge|official artist channel|badge_style_type_verified_artist/i.test(
        creatorHtml
      ) ||
      creatorHtml.indexOf('M9.03 2.242') !== -1 ||
      creatorHtml.indexOf('L14.001 9.7v4.55a2.75') !== -1;
    const hasVerifiedMarkup =
      /check_circle_thick|badge_style_type_verified|creator_verified/i.test(
        creatorHtml
      );

    const creatorSeen = new Set(creatorLabels);

    if (hasOfficialArtistMarkup) {
      pushUniqueValue(creatorLabels, 'Official Artist Channel', creatorSeen);
    }

    if (hasVerifiedMarkup) {
      pushUniqueValue(creatorLabels, 'Verified', creatorSeen);
    }

    if (
      hasCreatorIcon &&
      !creatorLabels.some(function (label) {
        return /official artist channel/i.test(label);
      })
    ) {
      pushUniqueValue(creatorLabels, 'Verified', creatorSeen);
    }

    return creatorLabels;
  }

  // Collect the metadata roots that may contain creator badges or channel info.
  function getCreatorRoots(card) {
    const roots = [];
    const seen = new Set();

    CREATOR_METADATA_ROOT_SELECTORS.forEach(function (selector) {
      card.querySelectorAll(selector).forEach(function (element) {
        if (seen.has(element)) {
          return;
        }

        seen.add(element);
        roots.push(element);
      });
    });

    return roots;
  }

  // Prefer explicit title nodes, then fall back to other watch-link candidates.
  function getTitle(card) {
    const candidates = [];

    for (let i = 0; i < TITLE_SELECTORS.length; i += 1) {
      const element = card.querySelector(TITLE_SELECTORS[i]);
      if (!element) {
        continue;
      }

      pushTitleCandidate(candidates, element.textContent);
      pushTitleCandidate(candidates, element.getAttribute('title'));
      pushTitleCandidate(candidates, element.getAttribute('aria-label'));

      if (candidates.length > 0) {
        return candidates[0];
      }
    }

    card.querySelectorAll('a[href*="/watch"]').forEach(function (element) {
      pushTitleCandidate(candidates, element.getAttribute('title'));
      pushTitleCandidate(candidates, element.getAttribute('aria-label'));
      pushTitleCandidate(candidates, element.textContent);
    });

    if (candidates.length > 0) {
      return candidates[0];
    }

    return null;
  }

  // Keep the first clean title candidate and ignore duplicates.
  function pushTitleCandidate(candidates, text) {
    const normalized = sanitizeTitleCandidate(text);
    if (!normalized || candidates.indexOf(normalized) !== -1) {
      return;
    }

    candidates.push(normalized);
  }

  // Strip non-title noise from accessibility labels before keyword matching.
  function sanitizeTitleCandidate(text) {
    let normalized = FilterCore.normalizeWhitespace(text);
    if (!normalized) {
      return null;
    }

    if (
      /\bby\b/i.test(normalized) &&
      (/\bviews?\b/i.test(normalized) || /\bago\b/i.test(normalized))
    ) {
      normalized = normalized.split(/\s+by\s+/i)[0];
    }

    if (!normalized || /^\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  // Collect visible text and descriptive attributes from a selector list.
  function collectCandidateTexts(card, selectors) {
    const seen = new Set();
    const values = [];

    selectors.forEach(function (selector) {
      card.querySelectorAll(selector).forEach(function (element) {
        pushCandidate(values, seen, element.textContent);

        if (typeof element.getAttribute === 'function') {
          pushCandidate(values, seen, element.getAttribute('aria-label'));
          pushCandidate(values, seen, element.getAttribute('title'));
        }
      });
    });

    return values;
  }

  // Read specific attributes when the useful value is not exposed as text.
  function collectAttributeTexts(card, selectors, attributes) {
    const seen = new Set();
    const values = [];

    selectors.forEach(function (selector) {
      card.querySelectorAll(selector).forEach(function (element) {
        attributes.forEach(function (attribute) {
          pushCandidate(values, seen, element.getAttribute(attribute));
        });
      });
    });

    return values;
  }

  // Merge fallback text sources without duplicating equivalent strings.
  function mergeUniqueTexts(primaryValues, secondaryValues) {
    const seen = new Set();
    const merged = [];

    primaryValues.concat(secondaryValues).forEach(function (value) {
      pushUniqueValue(merged, value, seen);
    });

    return merged;
  }

  // Append a value only once, optionally reusing an existing Set.
  function pushUniqueValue(values, value, seen) {
    const nextSeen = seen || new Set(values);

    if (!value || nextSeen.has(value)) {
      return;
    }

    nextSeen.add(value);
    values.push(value);
  }

  // Normalize and deduplicate raw text before parsing.
  function pushCandidate(values, seen, text) {
    const normalized = FilterCore.normalizeWhitespace(text);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    values.push(normalized);
  }

  // Return the first candidate string a parser can successfully interpret.
  function firstParsedValue(texts, parser) {
    for (let i = 0; i < texts.length; i += 1) {
      const parsed = parser(texts[i]);
      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }
})();
