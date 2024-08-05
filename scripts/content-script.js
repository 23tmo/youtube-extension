// Console output views of all videos using an observer
(function() {
    'use strict';

    // Get all homescreen videos
    var getVideos = function() {
        var contents = document.querySelectorAll(
            'div#contents[class="style-scope ytd-rich-grid-renderer"]'
        );
        return contents[0].children;
    }

    // Get video's views
    var getViews = function(video) {
        var metadata = video.querySelector(
            'div#metadata-line[class="style-scope ytd-video-meta-block"]'
        );
        if (metadata === null) {
            return null;
        } else {
            // Select the span element with the specified class
            var viewCountElement = metadata.querySelector('span.inline-metadata-item.style-scope.ytd-video-meta-block');

            // Get the text content of the selected element
            var viewCountText = viewCountElement.textContent; 

            // Remove ' views' and ' watching' labels, keep 'K' and 'M'
            var cleanedViewCount = viewCountText.replace(/(\sviews|\swatching)/, '');
            return cleanedViewCount;
        }
    }

    // Display videos views in console
    var run = function(){
        var videos = getVideos();
        for (var i = 0; i<videos.length; i++) {
            var video = videos[i];
            console.log(getViews(video));
        }
    }
    // Call run func with 3s delay to load page correctly
    setTimeout(run, 3000);

    // Repeatedly check for the target node
    var checkForTargetNode = function() {
        var targetNode = document.querySelector('div#contents.style-scope.ytd-rich-grid-renderer');
        if (targetNode) {
            // Set up a MutationObserver to watch for new videos being added to the DOM
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    console.log('running mutation observer');
                    setTimeout(run, 3000);
                });
            });

            // Start observing the target node for configured mutations
            const config = { childList: true, subtree: true };
            observer.observe(targetNode, config);

            // Initial run to load the current videos
            setTimeout(run, 3000);
        } else {
            // If the target node is not found, check again after a short delay
            console.error('Target node not found, retrying...');
            setTimeout(checkForTargetNode, 1000);
        }
    };

    // Initial call to check for the target node
    checkForTargetNode();

})();

