var MIN_VIEWS = null;
var MAX_VIEWS = null;

// Await 'apply' button click to start filter
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
    if (request.message === "givenThreshold"){
        chrome.storage.session.set(request.prefs);
        MIN_VIEWS = request.prefs.minPref;
        MAX_VIEWS = request.prefs.maxPref;
        filterVideos();
     }
})

function filterVideos() {
    'use strict';

    // Get all homescreen videos
    var getVideos = function(addedNodes) {
        // When addedNodes not null, only processes newly added nodes to DOM
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
        // Initial and rerendering run:
        return document.querySelectorAll('ytd-rich-item-renderer');
    }

    // Get video views
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
    
    var displayVideo = function(video){
        var views = getViews(video);
        var section = document.querySelector('ytd-rich-section-renderer');

        if (!views ||  
            (MAX_VIEWS && views > MAX_VIEWS) ||
            (MIN_VIEWS && views < MIN_VIEWS)) {
            // Changing display style instead of remove to reshow if threshold changes
            video.style.display = 'none'; 
        }
        else{
            video.style.display = 'block';
        }

        // Removing extra section breaks
        if (section){
            section.remove();
        }
    }

    // Process and display newly loaded videos
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
                // Run on all videos (included previously handled) regularly to catch re-rendered ones
                handleVideos(null);
            };

            // MutationObserver to watch for new videos being added to the DOM
            var observer = new MutationObserver(callback);

            // Start observing the target node for configured mutations
            observer.observe(targetNode, config);

            // Initial run to load current videos
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