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


const TIME_UNITS = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']; 

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
    if (request.message === "newPrefs" || request.message === "clearPrefs"){
        chrome.storage.session.set(request.prefs);
        const [minHours, minMinutes, minSeconds] = request.prefs.minDurationPref.split(':');
        const [maxHours, maxMinutes, maxSeconds] = request.prefs.maxDurationPref.split(':');

        Object.assign(MIN_DURATION, { hours: parseInt(minHours), minutes: parseInt(minMinutes), seconds: parseInt(minSeconds) }); 
        Object.assign(MAX_DURATION, { hours: parseInt(maxHours), minutes: parseInt(maxMinutes), seconds: parseInt(maxSeconds) });

        MIN_VIEWS = request.prefs.minPref;
        MAX_VIEWS = request.prefs.maxPref;
        TIME_VALUE = request.prefs.timeValuePref;
        TIME_UNIT = request.prefs.timeUnitPref;
        if (TIME_UNIT === 'select'){ 
            TIME_UNIT = null;
        }
     }
     init();
})
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

    // Convert text with 'K' or 'M' to number for comparison
    var convertToNumber = function(text){
        // Remove commas, convert to float
        var viewCountNumber = parseFloat(text.replace(/,/g, ''));
        if (text.includes('K')) {
            return viewCountNumber * 1000;
        } else if (text.includes('M')) {
            return viewCountNumber * 1000000;
        }
        return viewCountNumber;
    }

    var outsideViewRange = function(views){
        return (!views || (MAX_VIEWS && views > MAX_VIEWS) || (MIN_VIEWS && views < MIN_VIEWS));
    }

    var outsideAgeRange = function(age){
        if (age && TIME_UNIT && TIME_VALUE) {
            // Find the index of the age unit and the maximum allowed unit
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


    var outsideDurationRange = function(duration) {
        if (!duration) return false;
    
        const { hours, minutes, seconds } = duration;
        const { hours: minHours, minutes: minMinutes, seconds: minSeconds } = MIN_DURATION;
        const { hours: maxHours, minutes: maxMinutes, seconds: maxSeconds } = MAX_DURATION;
    
        const isBelowMin = hours < minHours ||
                           (hours === minHours && (minutes < minMinutes || 
                           (minutes === minMinutes && seconds < minSeconds)));
    
        const isAboveMax = hours > maxHours ||
                           (hours === maxHours && (minutes > maxMinutes || 
                           (minutes === maxMinutes && seconds > maxSeconds)));
    
        return isBelowMin || isAboveMax;
    };

    var displayVideo = function(video){
        var views = getViews(video);
        var age = getAge(video);
        var duration = getDuration(video);
        var section = document.querySelector('ytd-rich-section-renderer');

        if (outsideViewRange(views) || outsideDurationRange(duration) || outsideAgeRange(age)) {
            video.style.display = 'none';

        }
        else{
            video.style.display = 'block';
        }
        // Remove section if present
        if (section){
            section.remove();
        }
    }

    // Display videos views in console
    var handleVideos = function(addedNodes){
        var videos = getVideos(addedNodes);
        if(videos && videos != []){
            videos.forEach(displayVideo); 
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
            console.error('Target node not found, retrying...');
            setTimeout(run, 1000);
        }
    };

    // Initial run call
    run();
    
};