'use strict';

// Descriptive UA to satisfy arXiv's "please identify yourself" ask and
// minimize Reddit's generic-UA throttling. Reddit's API terms prefer
// "<platform>:<app id>:<version> (by /u/<username>)" but for an anonymous
// Electron client we use a project-identifying UA with a contact URL.
module.exports = {
  UA: 'MarkAllDown-SmartRSS/1.0 (+https://github.com/utssd/mark_all_down)',
};
