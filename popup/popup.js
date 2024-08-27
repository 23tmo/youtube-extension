document.addEventListener("DOMContentLoaded", runFunction);
console.log("DOM loaded");

function runFunction(){
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    //Elements
    const minViewsElement = document.getElementById('minViewsInput');
    const maxViewsElement = document.getElementById('maxViewsInput');
    const timeValueElement = document.getElementById('time-value');
    const timeUnitElement = document.getElementById('time-unit');

    // Apply
    const applyButton = document.getElementById('apply');
 
    applyButton.onclick = () => {
        const prefs = {
            minPref: minViewsElement.value,
            maxPref: maxViewsElement.value,
            timeValuePref: timeValueElement.value,
            timeUnitPref: timeUnitElement.value
        }
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {message: 'newPrefs', prefs});
        });
    }

    // Save user prefs until page reload
    chrome.storage.session.get(["minPref", "maxPref", "timeValuePref", "timeUnitPref"], (result) => {
        const { minPref, maxPref, timeValuePref, timeUnitPref } = result;
        if (minPref){
            minViewsElement.value = minPref;
        }
        if (maxPref){
            maxViewsElement.value = maxPref;
        } 
        if (timeValuePref){
            timeValueElement.value = timeValuePref;
        } 
        if (timeUnitPref){
            timeUnitElement.value = timeUnitPref;
        } 
    })
}
