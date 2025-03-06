document.addEventListener("DOMContentLoaded", runFunction);
console.log("DOM loaded");

function runFunction(){
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    //Elements
    const minViewsElement = document.getElementById('minViewsInput');
    const maxViewsElement = document.getElementById('maxViewsInput');
    const timeValueElement = document.getElementById('time-value');
    const timeUnitElement = document.getElementById('time-unit');
    const minDurationElement = document.getElementById('minDurInput');
    const maxDurationElement = document.getElementById('maxDurInput');

    // Buttons
    const applyButton = document.getElementById('apply');
    const clearButton = document.getElementById('clear');

    clearButton.onclick = () => {
        minViewsElement.value = '';
        maxViewsElement.value = '';
        timeValueElement.value = '';
        timeUnitElement.value = 'select';
        minDurationElement.value = '';
        maxDurationElement.value = '';
        
        const prefs = {
            minPref: null,
            maxPref: null,
            timeValuePref: null,
            timeUnitPref: null,
            minDurationPref: null,
            maxDurationPref: null
        }
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {message: 'clearPrefs', prefs});
        });
    }
 
    applyButton.onclick = () => {
        const prefs = {
            minPref: minViewsElement.value,
            maxPref: maxViewsElement.value,
            timeValuePref: timeValueElement.value,
            timeUnitPref: timeUnitElement.value,
            minDurationPref: minDurationElement.value,
            maxDurationPref: maxDurationElement.value
        }
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {message: 'newPrefs', prefs});
        });
    }

    // Save user prefs until page reload
    chrome.storage.session.get(["minPref", "maxPref", "timeValuePref", "timeUnitPref", 'minDurationPref', 'maxDurationPref'], (result) => {
        const { minPref, maxPref, timeValuePref, timeUnitPref, minDurationPref, maxDurationPref} = result;
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
        if (minDurationPref){
            minDurationElement.value = minDurationPref;
        } 
        if (maxDurationPref){
            maxDurationElement.value = maxDurationPref;
        } 
    })
}