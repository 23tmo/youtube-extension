const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadFilterCore() {
  const context = vm.createContext({});
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'content.js'),
    'utf8'
  );

  vm.runInContext(source, context);

  return context.YouTubeFilterCore;
}

const FilterCore = loadFilterCore();

test('normalizes movie feature preference', () => {
  assert.equal(
    FilterCore.normalizePrefs({ moviePref: true }).requireMovie,
    true
  );
  assert.equal(FilterCore.normalizePrefs({}).requireMovie, false);
});

test('keeps movie cards when movie feature is selected', () => {
  const prefs = FilterCore.normalizePrefs({ moviePref: true });

  assert.equal(
    FilterCore.evaluateVideo({ title: 'Concert', isMovie: false }, prefs)
      .shouldHide,
    true
  );
  assert.equal(
    FilterCore.evaluateVideo({ title: 'Feature', isMovie: true }, prefs)
      .shouldHide,
    false
  );
});

test('selected feature filters match any live sponsored or movie flag', () => {
  const prefs = FilterCore.normalizePrefs({
    livePref: true,
    sponsoredPref: true,
    moviePref: true,
  });

  assert.equal(
    FilterCore.evaluateVideo({ title: 'Premiere', isMovie: true }, prefs)
      .shouldHide,
    false
  );
  assert.equal(
    FilterCore.evaluateVideo({ title: 'Stream', isLive: true }, prefs)
      .shouldHide,
    false
  );
  assert.equal(
    FilterCore.evaluateVideo({ title: 'Ad', isSponsored: true }, prefs)
      .shouldHide,
    false
  );
  assert.equal(
    FilterCore.evaluateVideo({ title: 'Regular upload' }, prefs).shouldHide,
    true
  );
});

test('detects movies only from explicit non-title signals', () => {
  assert.equal(FilterCore.detectMovieFlag([], ['Movie'], [], [], true), true);
  assert.equal(
    FilterCore.detectMovieFlag([], ['Buy or rent'], [], [], true),
    true
  );
  assert.equal(
    FilterCore.detectMovieFlag(
      [],
      [],
      ['https://www.youtube.com/feed/storefront'],
      [],
      true
    ),
    true
  );
  assert.equal(
    FilterCore.detectMovieFlag([], [], [], ['ytd-movie-renderer'], true),
    true
  );
  assert.equal(
    FilterCore.detectMovieFlag([], ['The best movie trailers'], [], [], true),
    false
  );
});
