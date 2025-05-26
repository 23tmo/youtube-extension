var MAX_DURATION = {
    seconds: null,
    minutes: null,
    hours: null
};
var MIN_DURATION = {
    seconds: null,
    minutes: null,
    hours: null
};
var MAX_VIEWS = null;
var MIN_VIEWS = null;

var TIME_UNIT = null;
var TIME_VALUE = null;

var KEYWORDS = null;
var REGULAR_CREATOR = null;
var ARTIST_CREATOR = null;
var VERIFIED_CREATOR = null;
var LIVE = false;
var SPONSORED = false;

var ALL_VIDEOS = [];


const TIME_UNITS = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']; 

// Default values for preferences
var DEFAULT_PREFS = {
    minPref: null,
    maxPref: null,
    timeValuePref: null,
    timeUnitPref: null,
    minDurationPref: null,
    maxDurationPref: null,
    keywordsPref: null,
    regularCreatorPref: true,
    verifiedCreatorPref: true,
    artistCreatorPref: true,
    livePref: true,
    sponsoredPref: true
};

// Initialize with default values
var MAX_DURATION = { hours: 0, minutes: 0, seconds: 0 };
var MIN_DURATION = { hours: 0, minutes: 0, seconds: 0 };
var MAX_VIEWS = null;
var MIN_VIEWS = null;
var TIME_UNIT = null;
var TIME_VALUE = null;
var KEYWORDS = null;
var REGULAR_CREATOR = true;
var ARTIST_CREATOR = true;
var VERIFIED_CREATOR = true;
var LIVE = false;
var SPONSORED = false;

var CONCURRENCY_LIMIT = 20; // Try 10, 20, 30, etc.

const featureCache = new Map();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
    if (request.message === "newPrefs"){
        // Update preferences with null checks
        MIN_VIEWS = request.prefs.minPref !== null && request.prefs.minPref !== '' ? parseInt(request.prefs.minPref) : null;
        MAX_VIEWS = request.prefs.maxPref !== null && request.prefs.maxPref !== '' ? parseInt(request.prefs.maxPref) : null;
        TIME_VALUE = request.prefs.timeValuePref || null;
        TIME_UNIT = request.prefs.timeUnitPref === 'select' ? null : request.prefs.timeUnitPref;
        var rawKeywords = request.prefs.keywordsPref;
        KEYWORDS = rawKeywords ? rawKeywords.replace(/[^a-zA-Z0-9$%#',]/g, '').split(',').map(v => v.toLowerCase().trim()).filter(v => v) : null;
        REGULAR_CREATOR = request.prefs.regularCreatorPref;
        ARTIST_CREATOR = request.prefs.artistCreatorPref;
        VERIFIED_CREATOR = request.prefs.verifiedCreatorPref;
        LIVE = request.prefs.livePref;
        SPONSORED = request.prefs.sponsoredPref;

        // Handle duration preferences with null checks
        if (request.prefs.minDurationPref) {
            const timeParts = request.prefs.minDurationPref.split(':').map(Number);
            if (timeParts.length === 3) {
                Object.assign(MIN_DURATION, {
                    hours: timeParts[0] || 0,
                    minutes: timeParts[1] || 0,
                    seconds: timeParts[2] || 0
                });
            } else if (timeParts.length === 2) {
                Object.assign(MIN_DURATION, {
                    hours: 0,
                    minutes: timeParts[0] || 0,
                    seconds: timeParts[1] || 0
                });
            } else {
                Object.assign(MIN_DURATION, { hours: 0, minutes: 0, seconds: 0 });
            }
        } else {
            Object.assign(MIN_DURATION, { hours: 0, minutes: 0, seconds: 0 });
        }

        if (request.prefs.maxDurationPref) {
            const timeParts = request.prefs.maxDurationPref.split(':').map(Number);
            if (timeParts.length === 3) {
                Object.assign(MAX_DURATION, {
                    hours: timeParts[0] || 0,
                    minutes: timeParts[1] || 0,
                    seconds: timeParts[2] || 0
                });
            } else if (timeParts.length === 2) {
                Object.assign(MAX_DURATION, {
                    hours: 0,
                    minutes: timeParts[0] || 0,
                    seconds: timeParts[1] || 0
                });
            } else {
                Object.assign(MAX_DURATION, { hours: 0, minutes: 0, seconds: 0 });
            }
        } else {
            Object.assign(MAX_DURATION, { hours: 0, minutes: 0, seconds: 0 });
        }

        // Save to storage and reinitialize
        chrome.storage.session.set(request.prefs);
        init();
        sendResponse({status: "ok"});
    }
});

function init() {
    'use strict';

    // Get all homescreen videos
    var getVideos = function(addedNodes) {
        // Only getting recently loaded videos
        if (addedNodes){
            var videos = [];
            for (let i = 0; i < addedNodes.length; i++) {
                if(addedNodes[i].parentElement){
                    if(addedNodes[i].parentElement.id == 'content'){
                        videos.push(addedNodes[i].parentElement.parentElement); 
                    }
                }
            }
            return videos;
        }
        // Initial and rerendering runs:
        return document.querySelectorAll('ytd-rich-item-renderer');
    }

    // Get video's views
    var getViews = function(video) {
        var metadata = video.querySelector(
            'div#metadata-line'
        );
        if (metadata){
            var viewCountElement = Array.from(metadata.querySelectorAll('span.inline-metadata-item.style-scope.ytd-video-meta-block'))
                .find(element => element.textContent.includes('views'));
            
            if (viewCountElement){
                // Get the text content of the selected element
                var viewCountText = viewCountElement.textContent; 
                if (viewCountText === 'No views'){
                    return 0;
                }

                // Remove ' views' and ' watching' labels, keep 'K' and 'M'
                var cleanedViewCount = viewCountText.replace(/(\sviews|\swatching)/, '');
                return convertToNumber(cleanedViewCount);
            }
        }
        return null;
    }

    var getAge = function(video) {
        var metadata = video.querySelector(
            'div#metadata-line'
        );
        if (metadata){
            var ageElement = Array.from(metadata.querySelectorAll('span.inline-metadata-item.style-scope.ytd-video-meta-block'))
            .find(element => element.textContent.includes('ago'));
            if (ageElement){
                var ageText = ageElement.textContent.trim();
                ageText = ageText.replace(/Streamed\s*/i, '').replace(/ago\s*/i, '').trim();

                var ageParts = ageText.split(' '); // Split the text content by spaces

                // Assuming age is always in format "X unit ago" 
                var timeValue = ageParts[0]; 
                var timeUnit = ageParts[1]; 
                
                // Add 's' to unit if needed
                if (!timeUnit.endsWith('s')) {
                    timeUnit += 's';
                }

                var age = {
                    value: timeValue,
                    unit: timeUnit
                };

                return age;
            }
        }
        return null;
    }

    var getDuration = function(video){
        var timeStatus = video.querySelector('div#time-status');
        if (timeStatus){
            var timeText = timeStatus.querySelector('span#text').textContent;
            timeText = timeText.replace(/[^0-9:]/g, '').trim();
            var timeParts = timeText.split(':');
            
            // Default values
            var duration = {
                hours: 0,
                minutes: 0,
                seconds: 0
            };
            // Update duration based on the number of parts
            if (timeParts.length === 2) {
                duration.minutes = parseInt(timeParts[0]); // Minutes and seconds
                duration.seconds = parseInt(timeParts[1]);
            } else if (timeParts.length === 3) {
                duration.hours = parseInt(timeParts[0]); // Hours, minutes, and seconds
                duration.minutes = parseInt(timeParts[1]);
                duration.seconds = parseInt(timeParts[2]);
            }
            else{
                return null;
            }


            return duration;
        }
        return null; 
    }

    var getTitle = function(video){
        if(video.querySelector("#video-title")){
            return video.querySelector("#video-title").textContent;
        }
        return null;
    }

    var getBadge = function(video){
        var badges = video.querySelectorAll('div.badge');
        var badgeCollection = [];
        if(badges){
            for(const b of badges){
                // Get aria-label in a case-insensitive way
                const badgeLabel = b.getAttribute('aria-label');
                if (badgeLabel) {
                    badgeCollection.push(badgeLabel.trim());
                }
            }
            if(!badgeCollection.some(label => label === 'Official Artist Channel') && !badgeCollection.some(label => label === 'Verified')){
                badgeCollection.push('Regular');
            }
        }
        return badgeCollection;
    }

    var getLink = function(video){
        if(video.querySelector("#video-title-link")){
            return 'https://www.youtube.com' + video.querySelector("#video-title-link").getAttribute('href');
        }
    }

    // Convert text with 'K' or 'M' to number for comparison
    var convertToNumber = function(text){
        // Remove commas, convert to float
        var viewCountNumber = parseFloat(text.replace(/,/g, ''));
        if (text.includes('B')) {
            return viewCountNumber * 1000000000;
        } else if (text.includes('M')) {
            return viewCountNumber * 1000000;
        } else if (text.includes('K')) {
            return viewCountNumber * 1000;
        }
        return viewCountNumber;
    }

    var outsideViewRange = function(views){
        if (!MIN_VIEWS && !MAX_VIEWS) return false;
        return (!views || (MAX_VIEWS && views > MAX_VIEWS) || (MIN_VIEWS && views < MIN_VIEWS));
    }

    var outsideAgeRange = function(age){
        if (!TIME_UNIT || !TIME_VALUE) return false;
        if (age) {
            var ageUnitIndex = TIME_UNITS.indexOf(age.unit);
            var maxUnitIndex = TIME_UNITS.indexOf(TIME_UNIT);

            if (ageUnitIndex > maxUnitIndex) {
                return true;
            }

            if (ageUnitIndex === maxUnitIndex) {
                return age.value > TIME_VALUE;
            }
        }
        return false;
    }

    var titleHasKeywords = function(title){
        if(!KEYWORDS || !title) return false;
        var titleWords = title.replace(/[^a-zA-Z0-9$%#' ]/g, '').split(' ');
        titleWords = titleWords.map(v => v.toLowerCase().trim()).filter(v => v);
        return KEYWORDS.some(v => titleWords.includes(v));
    }

    var outsideDurationRange = function(duration) {
        // If no duration filters are set, show all videos
        if (!MIN_DURATION.hours && !MIN_DURATION.minutes && !MIN_DURATION.seconds &&
            !MAX_DURATION.hours && !MAX_DURATION.minutes && !MAX_DURATION.seconds) {
            return false;
        }

        if (!duration) return false;
    
        const { hours, minutes, seconds } = duration;
        const { hours: minHours, minutes: minMinutes, seconds: minSeconds } = MIN_DURATION;
        const { hours: maxHours, minutes: maxMinutes, seconds: maxSeconds } = MAX_DURATION;
    
        // Convert to total seconds for easier comparison
        const videoTotalSeconds = hours * 3600 + minutes * 60 + seconds;
        const minTotalSeconds = minHours * 3600 + minMinutes * 60 + minSeconds;
        const maxTotalSeconds = maxHours * 3600 + maxMinutes * 60 + maxSeconds;
    
        // Only check min if it's set
        const isBelowMin = minTotalSeconds > 0 && videoTotalSeconds < minTotalSeconds;
        // Only check max if it's set
        const isAboveMax = maxTotalSeconds > 0 && videoTotalSeconds > maxTotalSeconds;
    
        return isBelowMin || isAboveMax;
    };

    var unwantedCreator = function(badgeCollection) {
        if(REGULAR_CREATOR && ARTIST_CREATOR && VERIFIED_CREATOR) return false;
        
        var allowedCreators = [];
        if(ARTIST_CREATOR) allowedCreators.push('Official Artist Channel');
        if(VERIFIED_CREATOR) allowedCreators.push('Verified');
        if(REGULAR_CREATOR) allowedCreators.push('Regular');
        
        return !badgeCollection.some(badge => allowedCreators.includes(badge));
    }

    var displayVideo = function(video){
        var views = getViews(video);
        var age = getAge(video);
        var duration = getDuration(video);
        var title = getTitle(video);
        var section = document.querySelector('ytd-rich-section-renderer');
        var badges = getBadge(video);

        const viewCheck = outsideViewRange(views);
        const durationCheck = outsideDurationRange(duration);
        const ageCheck = outsideAgeRange(age);
        const keywordCheck = KEYWORDS ? !titleHasKeywords(title) : false;
        const creatorCheck = unwantedCreator(badges);

        // Inclusive OR logic for live/sponsored
        const isLive = badges.some(badge => badge && badge.toUpperCase() === 'LIVE');
        const isSponsored = badges.some(badge => badge && badge.toUpperCase() === 'SPONSORED');
        let featureCheck = false;
        if (LIVE || SPONSORED) {
            if (LIVE && !SPONSORED) featureCheck = !isLive;
            else if (!LIVE && SPONSORED) featureCheck = !isSponsored;
            else if (LIVE && SPONSORED) featureCheck = !(isLive || isSponsored);
        } else {
            featureCheck = false; // show all if neither is checked
        }

        if (viewCheck || durationCheck || ageCheck || keywordCheck || creatorCheck || featureCheck) {
            video.style.display = 'none';
        }
        else{
            video.style.display = 'block';
        }
        if (section){
            section.remove();
        }
    }
    
    var handleVideos = function(addedNodes) {
        var videos = getVideos(addedNodes);
        if (videos && videos.length > 0) {
            Array.from(videos).forEach(displayVideo);
        }
    }

    // Run mutation observer to check for DOM changes
    var run = function() {
        var targetNode = document.querySelector('div#contents.style-scope.ytd-rich-grid-renderer');
        if (targetNode) {
            const config = { childList: true, subtree: false, attributes: false};

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    if (mutation.addedNodes.length) {
                        handleVideos(mutation.addedNodes);
                    }
                }
                // Run on all videos regularly to catch re-rendered ones
                handleVideos(null);
            };

            // MutationObserver to watch for new videos being added to the DOM
            var observer = new MutationObserver(callback);

            // Start observing the target node for configured mutations
            observer.observe(targetNode, config);
            
            // Initial run to load the current videos
            handleVideos(null);
        } else {
            // If the target node is not found, check again after a short delay
            setTimeout(run, 1000);
        }
    };

    // Initial run call
    run();
};