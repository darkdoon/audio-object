var path = require('path');
var gulp = require('gulp');

/*
  We should put the configuration into a separate package
  @soundio/audio-object-config

  var CONFIG = require('audio-object-config');
 */
var CONFIG = {};

CONFIG.dir = {
  src: 'js',
  build: 'build',
  testSpec: 'test/spec',
  testConfig: 'test/config'
}

CONFIG.files = {
  src: path.join(CONFIG.dir.src, '**', '*.js'),
  testSpec: path.join(CONFIG.dir.testSpec, '**', '*.spec.js')
}

CONFIG.plugins = {
  loadPlugins: {

  },
  karma: {
    // unfortunately, karma needs the __dirname here
    configFile: path.join(__dirname, CONFIG.dir.testConfig, 'karma.conf.js'),
    browsers: ['Chrome'],
    singleRun: true
  }
}

/*
  We should put the gulp-tasks into a separate package
  @soundio/audio-object-tasks

  var tasks = require('audio-object-tasks');
*/
// Load the gulp plugins
var $ = require('gulp-load-plugins')(CONFIG.plugins.loadPlugins);
var source = require('vinyl-source-stream');
var stream = require('event-stream');
var karma = require('karma').server;
var browserify = require('browserify');
var babelify = require('babelify');
var glob = require('glob-all');

// Clean the build directory
gulp.task('clean:build', function() {
  return gulp.src(CONFIG.dir.build)
    .pipe($.clean());
});

// Lint the source files
gulp.task('lint:src', function() {
  return gulp.src([
      CONFIG.files.src
    ])
    // eslint() attaches the lint output to the eslint property
    // of the file object so it can be used by other modules.
    .pipe($.eslint())
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe($.eslint.format())
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failOnError last.
    .pipe($.eslint.failOnError());
});

function gulpES6Transpile(files, dest) {
  // map them to our stream function
  var tasks = files.map(function(entry) {
    return browserify({ entries: [entry] })
      .transform(babelify)
      .bundle()
      .pipe(source(entry))
      .pipe(gulp.dest(dest)); 
    });
  // create a merged stream
  return stream.merge.apply(null, tasks);
}

// Transpile source files from ES6 into ES5
gulp.task('transpile:src', function() {
  return gulpES6Transpile(
    glob.sync([
      CONFIG.files.src
    ]),
    CONFIG.dir.build
  )
});

// Run the unit tests
gulp.task('test:spec', function(done) {
  return karma
    .start(CONFIG.plugins.karma, function(err) {
      // Stop the gulp task when an error occurs
      // in the unit tests
      if (err) {
        process.exit(1);
      }
      done();
    });
});

gulp.task('default', function(done) {
  $.runSequence(['clean:build', 'lint:src', 'test:spec', 'transpile:src'], done);
});

gulp.task('watch', function() {
  gulp.watch(CONFIG.files.src, ['default'])
});