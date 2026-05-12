document.addEventListener('DOMContentLoaded', function () {
  runFunction();

  const tipToggle = document.getElementById('tip-toggle');
  const featureHelp = document.getElementById('feature-help');
  const errorMessage = document.getElementById('error-message');
  if (tipToggle && featureHelp && errorMessage) {
    featureHelp.style.display = 'none';
    errorMessage.style.display = 'none';
    let tipVisible = false;
    tipToggle.style.background = '#444';
    tipToggle.style.color = '#212121';
    tipToggle.addEventListener('click', function () {
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

    const origShowError = function (msg) {
      errorMessage.textContent = msg;
      errorMessage.style.display = 'block';
      featureHelp.style.display = 'none';
      tipVisible = false;
      tipToggle.setAttribute('aria-pressed', false);
      tipToggle.style.background = '#444';
      tipToggle.style.color = '#212121';
    };
    window.showPopupError = origShowError;
  }
});

function runFunction() {
  try {
    if (chrome.storage?.session?.setAccessLevel) {
      chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      });
    }
  } catch {
    // Firefox and Safari do not implement setAccessLevel; session storage still works.
  }

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
  const movieElement = document.getElementById('movieVideo');
  const playlistElement = document.getElementById('playlistVideo');

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
    const matchingOption = options.querySelector(
      `.dropdown-option[data-value="${normalizedValue}"]`
    );

    selected.textContent = matchingOption
      ? matchingOption.textContent
      : 'select';
    options.querySelectorAll('.dropdown-option').forEach((opt) => {
      opt.classList.toggle(
        'selected',
        opt.getAttribute('data-value') === normalizedValue
      );
    });
  }

  // Add input validation
  timeValueElement.addEventListener('input', function () {
    if (Number(this.value) < 0) {
      this.value = 0;
    }
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
    movieElement.checked = false;
    playlistElement.checked = false;
  };

  applyButton.onclick = () => {
    let hasError = false;
    errorMessage.style.display = 'none';

    if (
      Number(minViewsElement.value) < 0 ||
      Number(maxViewsElement.value) < 0
    ) {
      hasError = true;
    }
    if (
      minViewsElement.value &&
      maxViewsElement.value &&
      parseInt(maxViewsElement.value) < parseInt(minViewsElement.value)
    ) {
      hasError = true;
    }

    // Validate duration format
    const durationPattern = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
    if (
      minDurationElement.value &&
      !durationPattern.test(minDurationElement.value)
    ) {
      hasError = true;
    }
    if (
      maxDurationElement.value &&
      !durationPattern.test(maxDurationElement.value)
    ) {
      hasError = true;
    }

    if (hasError) {
      window.showPopupError('Invalid input');
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
      sponsoredPref: sponsoredElement.checked,
      moviePref: movieElement.checked,
      playlistPref: playlistElement.checked,
    };
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { message: 'newPrefs', prefs },
        function () {
          void chrome.runtime.lastError;
        }
      );
    });
  };

  // Save user prefs until page reload
  const sessionStorage = chrome.storage && chrome.storage.session;
  if (!sessionStorage) {
    return;
  }

  sessionStorage.get(
    [
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
    ],
    (result) => {
      const {
        minPref,
        maxPref,
        timeValuePref,
        timeUnitPref,
        minDurationPref,
        maxDurationPref,
        keywordsPref,
        regularCreatorPref,
        verifiedCreatorPref,
        artistCreatorPref,
        livePref,
        sponsoredPref,
        moviePref,
        playlistPref,
      } = result;
      if (minPref) {
        minViewsElement.value = minPref;
      }
      if (maxPref) {
        maxViewsElement.value = maxPref;
      }
      if (timeValuePref) {
        timeValueElement.value = timeValuePref;
      }
      if (timeUnitPref) {
        setSelectedTimeUnit(timeUnitPref);
      } else {
        setSelectedTimeUnit('select');
      }
      if (minDurationPref) {
        minDurationElement.value = minDurationPref;
      }
      if (maxDurationPref) {
        maxDurationElement.value = maxDurationPref;
      }
      if (keywordsPref) {
        keywordsElement.value = keywordsPref;
      }
      if (regularCreatorPref === true || regularCreatorPref === false) {
        regularCreatorElement.checked = regularCreatorPref;
      }
      if (verifiedCreatorPref === true || verifiedCreatorPref === false) {
        verifiedCreatorElement.checked = verifiedCreatorPref;
      }
      if (artistCreatorPref === true || artistCreatorPref === false) {
        artistCreatorElement.checked = artistCreatorPref;
      }
      if (livePref === true || livePref === false) {
        liveElement.checked = livePref;
      }
      if (sponsoredPref === true || sponsoredPref === false) {
        sponsoredElement.checked = sponsoredPref;
      }
      if (moviePref === true || moviePref === false) {
        movieElement.checked = moviePref;
      }
      if (playlistPref === true || playlistPref === false) {
        playlistElement.checked = playlistPref;
      }
    }
  );

  selected.addEventListener('click', function () {
    options.style.display =
      options.style.display === 'block' ? 'none' : 'block';
  });

  options.querySelectorAll('.dropdown-option').forEach((option) => {
    option.addEventListener('click', function () {
      setSelectedTimeUnit(this.getAttribute('data-value'));
      options.style.display = 'none';
    });
  });

  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target)) {
      options.style.display = 'none';
    }
  });
}
