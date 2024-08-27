document.addEventListener("DOMContentLoaded", runFunction);
console.log("DOM loaded");

function runFunction(){
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

    const minViewsElement = document.getElementById('minViewsInput');
    const maxViewsElement = document.getElementById('maxViewsInput');
    const applyButton = document.getElementById('apply');
 
    applyButton.onclick = () => {
        const prefs = {
            minPref: minViewsElement.value,
            maxPref: maxViewsElement.value
        }
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {message: 'givenThreshold', prefs});
        });
    }

    // Save user prefs until page reload
    chrome.storage.session.get(["minPref", "maxPref"], (result) => {
        const { minPref, maxPref } = result;
        if (minPref){
            minViewsElement.value = minPref;
        }
        if (maxPref){
            maxViewsElement.value = maxPref;
        } 
    })
}
