(function() {
    'use strict';
    
    // Number of valid videos within view range
    var NUM_VIDEOS = 0;
    var MIN_VIEWS = 10000000;

    // Get all homescreen videos
    var getVideos = function() {
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
                    return null;
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
        // remove commas, convert to float
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
        var section = document.querySelector('div#content.style-scope.ytd-rich-section-renderer');
        if (!views || views <= MIN_VIEWS) {
            video.remove();
        } 
        // Remove movies section if present
        if (section){
            section.remove();
        }
    }

    // Display videos views in console
    var handleVideos = function(){
        var videos = getVideos();
        videos.forEach(displayVideo);
    }

    // Run mutation observer to check for DOM changes
    var run = function() {
        var targetNode = document.querySelector('div#contents.style-scope.ytd-rich-grid-renderer');
        if (targetNode) {
            const config = { childList: true, subtree: true };

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    if (mutation.addedNodes.length > 0) {
                        setTimeout(handleVideos, 1000);
                    }
                }
            };

            // MutationObserver to watch for new videos being added to the DOM
            var observer = new MutationObserver(callback);

            // Start observing the target node for configured mutations
            observer.observe(targetNode, config);

            // Initial run to load the current videos
            setTimeout(handleVideos, 1000);

        } else {
            // If the target node is not found, check again after a short delay
            console.error('Target node not found, retrying...');
            setTimeout(run, 1000);
        }
    };

    // Initial run call
    run();
})();