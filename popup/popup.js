document.addEventListener("DOMContentLoaded", function() {
    runFunction();

    // Wire the help popover so the live and sponsored rule is documented in the UI.
    const tipToggle = document.getElementById('tip-toggle');
    const featureHelp = document.getElementById('feature-help');
    const errorMessage = document.getElementById('error-message');
    if (tipToggle && featureHelp && errorMessage) {
        featureHelp.style.display = 'none';
        errorMessage.style.display = 'none';
        let tipVisible = false;
        tipToggle.style.background = '#444';
        tipToggle.style.color = '#212121';
        tipToggle.addEventListener('click', function() {
            tipVisible = !tipVisible;
            featureHelp.style.display = tipVisible ? 'block' : 'none';
            if (tipVisible) {
                errorMessage.style.display = 'none';
                tipToggle.setAttribute('aria-pressed', true);
                tipToggle.style.background = '#e0e0e0';
                tipToggle.style.color = '#000';
            } else {
                tipToggle.setAttribute('aria-pressed', false);
                tipToggle.style.background = '#444';
                tipToggle.style.color = '#212121';
            }
        });

        // Error message logic to hide tip and reset help circle when showing error
        const origShowError = function(msg) {
            if (errorMessage && featureHelp && tipToggle) {
                errorMessage.textContent = msg;
                errorMessage.style.display = 'block';
                featureHelp.style.display = 'none';
                tipVisible = false;
                tipToggle.setAttribute('aria-pressed', false);
                tipToggle.style.background = '#444';
                tipToggle.style.color = '#212121';
            }
        };
        window.showPopupError = origShowError;
    }
});

function runFunction(){
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    
    //Elements
    const minViewsElement = document.getElementById('minViewsInput');
    const maxViewsElement = document.getElementById('maxViewsInput');
    const timeValueElement = document.getElementById('time-value');
    const timeUnitElement = document.getElementById('time-unit');
    const minDurationElement = document.getElementById('minDurInput');
    const maxDurationElement = document.getElementById('maxDurInput');
    const keywordsElement = document.getElementById('keywordsInput');
    const regularCreatorElement = document.getElementById('regularCreator');
    const verifiedCreatorElement = document.getElementById('verifiedCreator');
    const artistCreatorElement = document.getElementById('artistCreator');
    const liveElement = document.getElementById('liveVideo');
    const sponsoredElement = document.getElementById('sponsoredVideo');

    // Buttons
    const applyButton = document.getElementById('apply');
    const clearButton = document.getElementById('clear');
    const errorMessage = document.getElementById('error-message');

    // Custom dropdown logic
    const dropdown = document.getElementById('time-unit-dropdown');
    const selected = document.getElementById('dropdown-selected');
    const options = document.getElementById('dropdown-options');
    const hiddenInput = document.getElementById('time-unit');

    // Keep the visible custom dropdown and hidden input value in sync.
    function setSelectedTimeUnit(value) {
        const normalizedValue = value || 'select';
        hiddenInput.value = normalizedValue;
        const matchingOption = options.querySelector(`.dropdown-option[data-value="${normalizedValue}"]`);

        selected.textContent = matchingOption ? matchingOption.textContent : 'select';
        options.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.toggle('selected', opt.getAttribute('data-value') === normalizedValue);
        });
    }

    // Add input validation
    timeValueElement.addEventListener('input', function() {
        if (this.value < 0) this.value = 0;
    });

    clearButton.onclick = () => {
        // Reset all input fields to default values
        minViewsElement.value = '';
        maxViewsElement.value = '';
        timeValueElement.value = '';
        setSelectedTimeUnit('select');
        minDurationElement.value = '';
        maxDurationElement.value = '';
        keywordsElement.value = '';
        regularCreatorElement.checked = true;
        verifiedCreatorElement.checked = true;
        artistCreatorElement.checked = true;
        liveElement.checked = false;
        sponsoredElement.checked = false;
    }
 
    applyButton.onclick = () => {
        let hasError = false;
        errorMessage.style.display = 'none';

        // Validate views
        if (minViewsElement.value < 0 || maxViewsElement.value < 0) {
            hasError = true;
        }
        if (minViewsElement.value && maxViewsElement.value && parseInt(maxViewsElement.value) < parseInt(minViewsElement.value)) {
            hasError = true;
        }

        // Validate duration format
        const durationPattern = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
        if (minDurationElement.value && !durationPattern.test(minDurationElement.value)) {
            hasError = true;
        }
        if (maxDurationElement.value && !durationPattern.test(maxDurationElement.value)) {
            hasError = true;
        }

        if (hasError) {
            window.showPopupError("Invalid input");
            return;
        }

        const prefs = {
            minPref: minViewsElement.value || null,
            maxPref: maxViewsElement.value || null,
            timeValuePref: timeValueElement.value || null,
            timeUnitPref: timeUnitElement.value,
            minDurationPref: minDurationElement.value || null,
            maxDurationPref: maxDurationElement.value || null,
            keywordsPref: keywordsElement.value || null,
            regularCreatorPref: regularCreatorElement.checked,
            verifiedCreatorPref: verifiedCreatorElement.checked,
            artistCreatorPref: artistCreatorElement.checked,
            livePref: liveElement.checked,
            sponsoredPref: sponsoredElement.checked
        };
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {message: 'newPrefs', prefs}, function(response) {
            });
        });
    }

    // Save user prefs until page reload
    chrome.storage.session.get(["minPref", "maxPref", "timeValuePref", "timeUnitPref", 
                                'minDurationPref', 'maxDurationPref', 'keywordsPref', 
                                'regularCreatorPref', 'verifiedCreatorPref', 'artistCreatorPref',
                                'livePref', 'sponsoredPref'], (result) => {
        const { minPref, maxPref, timeValuePref, timeUnitPref, 
                minDurationPref, maxDurationPref, keywordsPref, 
                regularCreatorPref, verifiedCreatorPref, artistCreatorPref,
                livePref, sponsoredPref } = result;
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
            setSelectedTimeUnit(timeUnitPref);
        } else {
            setSelectedTimeUnit('select');
        }
        if (minDurationPref){
            minDurationElement.value = minDurationPref;
        } 
        if (maxDurationPref){
            maxDurationElement.value = maxDurationPref;
        } 
        if (keywordsPref){
            keywordsElement.value = keywordsPref;
        } 
        if (regularCreatorPref == true || regularCreatorPref == false){
            regularCreatorElement.checked = regularCreatorPref;            
        }
        if (verifiedCreatorPref == true || verifiedCreatorPref == false){
            verifiedCreatorElement.checked = verifiedCreatorPref;
        }
        if (artistCreatorPref == true || artistCreatorPref == false){
            artistCreatorElement.checked = artistCreatorPref; 
        }
        if (livePref == true || livePref == false){
            liveElement.checked = livePref; 
        }
        if (sponsoredPref == true || sponsoredPref == false){
            sponsoredElement.checked = sponsoredPref; 
        }
    });

    selected.addEventListener('click', function(e) {
        options.style.display = options.style.display === 'block' ? 'none' : 'block';
    });

    options.querySelectorAll('.dropdown-option').forEach(option => {
        option.addEventListener('click', function(e) {
            setSelectedTimeUnit(this.getAttribute('data-value'));
            options.style.display = 'none';
        });
    });

    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            options.style.display = 'none';
        }
    });
}
