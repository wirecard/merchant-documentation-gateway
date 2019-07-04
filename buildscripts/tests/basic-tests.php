<?php // php -d display_errors=1

/*
Tests all .adoc files in current folder for errors using asciidoctor. Treat warnings as errors.
Get branch / task ID from git log where available.
Use multithreading with thread pool to speed up the process.

                                                  herbert.knapp@wirecard.com
*/

error_reporting( E_ALL );
set_error_handler( 'exceptions_error_handler' );

function exceptions_error_handler( $severity, $message, $filename, $lineNo ) {
  if ( error_reporting() == 0 ) {
    return;
  }
  if ( error_reporting() & $severity ) {
    throw new ErrorException( $message, 0, $severity, $filename, $lineNo );
  }
}

const PULL_REQUEST_BRANCH = "Pull Request";

class Task extends Threaded {
  private $threadID;
  private $filename;
  private $result;

  public function __construct( string $filename ) {
    $this->filename = $filename;
  }

  public function run() {

    $asciidoctorOutput = getAsciidoctorOutput( $this->filename );
    // filter http links
    $asciidoctorOutput['links'] = preg_grep( '/^https?:/', $asciidoctorOutput['links'] );
    $gitBranch = getBranchOfFile( $this->filename );
    $gitAuthor = getLastEditedByOfFile( $this->filename );

    // Cast as array to prevent implicit conversion to a Volatile object
    $result = (array)array( 'filename' => $this->filename,
                            'branch'   => $gitBranch,
                            'author'   => $gitAuthor,
                            'tests'    => array()
                          );

    // made another exception for index.adoc here
    // test index.adoc only for "global" errors that asciidoctor produces
    // all other tests are perfomed on the individual files
    // global errors are added to individual reports in postprocessErrors()

    if( $this->filename === 'index.adoc' ){
      $result['tests'] = array( 'anchors'     => array(),
                                'patterns'    => array(),
                                'links'       => array(),
                                'asciidoctor' => $asciidoctorOutput['errors']
                              );
    }
    else {
      $result['tests'] = array( 'anchors'     => testAnchors( $asciidoctorOutput['anchors'] ),
                                'patterns'    => testPatterns( $this->filename ),
                                'links'       => testUrls( $asciidoctorOutput['links'] ),
                                'asciidoctor' => array()
                              );
    }
    // TODO put this in if(==index.adoc) bc index contains all valid anchors
    $result['anchors'] = $asciidoctorOutput['anchors'];
    $this->resultsArray = (array)$result;
  }

  public function getResults() {
    return $this->resultsArray;
  }
}

class UrlTest extends Threaded {
  private $url;
  private $httpStatusCode;

  public function __construct( string $url ) {
    $this->url = $url;
  }

  public function run() {
    $this->httpStatusCode = intval( substr( get_headers( $this->url )[0], 9, 3 ) );
  }

  // Returns 0 on "false", i.e. timeouts
  public function getResult() {
    return array( 'url' => $this->url, 'httpStatusCode' => $this->httpStatusCode );
  }
}


class SearchFileTask extends Threaded {
  private $searchResults;
  private $filename;
  private $references;

  public function __construct( string $filename, array $references ) {
    $this->filename = $filename;
    $this->references = $references;
  }

  public function run() {
    $results = array();

    $fileContent = file( $this->filename );

    foreach( $this->references as $reference ) {
      $matchingLines = preg_grep( '/<<'.$reference.',/', $fileContent );
      foreach( $matchingLines as $lineNumber => $lineContent ) {
        $results[] = array( 'reference'   => $reference,
                            'lineNumber'  => $lineNumber + 1,
                            'lineContent' => trim( $lineContent )
                          );
      }
    }

    // Cast to avoid implicit conversion to Volatile object
    $this->searchResults = (array)$results;
  }
  public function getFoundReferences() {
    return $this->searchResults;
  }
}

// simple pattern matching for anchor validity check
function testAnchors( $anchorsArray ) {
  $anchorErrorsMap = array(
                            array( 'type'     => 'missing',
                                   'pattern'  => '/^_/',
                                   'message'  => 'Missing Anchor',
                                   'severity' => 'WARN' ),

                            array( 'type'     => 'format',
                                   'pattern'  => '/[^A-Za-z0-9_\{\}\-]/',
                                   'message'  => 'Invalid Anchor Format',
                                   'severity' => 'ERROR' )
                          );

  $testsResultsArray = array();
  foreach( $anchorsArray as $anchorID => $anchorText ) {
    foreach( $anchorErrorsMap as $errorType ) {
      if( preg_match( $errorType['pattern'], $anchorID ) ) {
        $testsResultsArray[] = array( 'errorType'    => $errorType['type'],
                                      'anchorID'     => $anchorID,
                                      'anchorText'   => html_entity_decode( strip_tags( $anchorText ) ),
                                      'errorMessage' => $errorType['message'],
                                      'severity'     => $errorType['severity']
                                    );
      }
    }
  }
  return $testsResultsArray;
}

// testUrls uses thread pool to test array of URLs for 404 or 0(==general error)
// returns array of arrays of failed urls ( url => 'https://x.yz', httpStatusCode => 404 )
function testUrls( $urlsArray ) {
  $numConcurrentUrlTests = 20;
  $urlCheckPool = new Pool( $numConcurrentUrlTests );

  $httpErrorsMap = array( 0   => 'Timeout or Invalid Host',
                          404 => '404 Page Not Found',
                          301 => 'Page Moved' );


  $urlCheckTasksArray = array();
  $numUrls = sizeof( $urlsArray );
  foreach ( $urlsArray as $url ) {
    $urlCheckTask = new UrlTest( $url );
    $urlCheckTasksArray[] = $urlCheckTask;
    $urlCheckPool->submit( $urlCheckTask );
  }
  while ( $urlCheckPool->collect() );
  $urlCheckPool->shutdown();

  // Fill tests results array with array('url' =>, 'httpStatusCode' =>)
  $testsResultsArray = array();
  foreach ( $urlCheckTasksArray as $ut ) {

    // Get URL and Status Code
    $result = $ut->getResult();
    $httpStatusCode = $result['httpStatusCode'];

    // See if the (int) http status code matches an error. if yes, add it to test results
    if( array_key_exists( $httpStatusCode, $httpErrorsMap ) ){
      $testsResultsArray[] = array( 'url'              => $result['url'],
                                    'httpStatusCode'   => $httpStatusCode,
                                    'httpErrorMessage' => $httpErrorsMap[$httpStatusCode] );
    }
  }
  return $testsResultsArray;
}

// getBranchOfFile returns originating branch of file
// if empty returns current branch
function getBranchOfFile( $filename, $pattern='PSPDOC-[0-9]\+' ) {
  $cmd_origin = 'git --no-pager log --decorate=short --pretty=oneline --follow -- "' . $filename . '" | sed -n "s/.*(origin\/\(' . $pattern . '\)).*/\1/p" | head -n 1';
  $cmd_current = 'git rev-parse --abbrev-ref HEAD';

  return exec( $cmd_origin ) ?: exec ( $cmd_current );
}

// not reliable across branches. use last edited by
function getAuthorOfFile( $filename ) {
  $cmd_git_log_email = 'git log --follow --pretty=format:%ae -- "' . $filename . '" | tail -n 1';
  $author_email_local_part = preg_replace( '/([0-9\+]+)?(.*)@.*/', '$2', exec( $cmd_git_log_email ) );
  $author = ucwords( str_replace( '.', ' ', $author_email_local_part ) );
  return $author;
}

function getLastEditedByOfFile( $filename ) {
  $author = 'git log -1 --pretty=format:%an -- "' . $filename . '"';
  return exec( $author );
}

function getCommitAuthor() {
  $commiter = 'git log -1 --pretty=format:%an';
  return exec( $commiter );
}

function getCurrentBranch() {
  $cmd_git_branch = 'git name-rev --name-only HEAD';
  $currentBranch = exec( $cmd_git_branch );
  if ( empty( $currentBranch ) ) return 'Pull_Request';
  return $currentBranch;
}

// getAsciidoctorOutput parses asciidoctor helper json output
// returns all links in document          as $result['links']
//         all anchors                    as $result['anchors']
//         all error messages of asciidoc as $result['errors']
function getAsciidoctorOutput( $filename ) {

//  $asciidocPattern = '/asciidoctor: ([A-Z]+): (.*.adoc): line ([0-9]+): (.*)/';
//  $result = array();

  //$cmd = 'asciidoctor --failure-level=WARN -b html5 -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram "' . $filename . '" -o /dev/null 2>&1';
  //exec( $cmd, $result['consoleOutput'], $result['exitCode'] );

  $asciidoctorJSON = shell_exec( 'node buildscripts/tests/asciidoctor-helper.js --file "'.$filename.'"' );
  $asciidoctorOutput = json_decode( $asciidoctorJSON, true );

  // Format Output
  $result = array();

  // initialize this.. or else... regret it
  $results = array();
  foreach( $asciidoctorOutput['errors'] as $key => $e ) {
    $singleError = array();
    $singleError['severity'] = $e['severity'];
    $singleError['filename'] = $filename;
    if( is_array( $e['message'] ) ) {
      $singleError['lineNumber'] = $e['message']['source_location']['lineno'];
      $singleError['message']    = $e['message']['text'];
      $singleError['filename']   = $e['message']['source_location']['path'];
    }
    else {
      $singleError['message']  = $e['message'];
    }

    if( substr( $singleError['message'], 0, 18 ) === "invalid reference:" ) {
      // ignore invalid reference error if its not produced by index.adoc
      if( $singleError['filename'] !== 'index.adoc' ) {
        continue;
      }
    }
    $results['errors'][] = $singleError;
  }

  $results['links']   = $asciidoctorOutput['links'];
  $results['anchors'] = $asciidoctorOutput['ids'];
  return $results;
}

// Checks file for offending patterns and returns line number
function testPatterns( $filename ){

  $matchedLinesArray = array();

  $patternListFile = file( 'buildscripts/tests/invalid_patterns_list.txt', FILE_IGNORE_NEW_LINES );
  $testPatternsArrays = array();
  foreach( $patternListFile as $value ) {
    // if delimiter not found, skip the line
    if( strpos( $value, ':::', 1 ) !== false ) {
      $testPatternsArrays[] = explode( ':::', $value );
    }
  }

  $fileContent = file( $filename );

  foreach( $testPatternsArrays as $key => $patterns ) {
      $linesFound = preg_grep( $patterns[0], $fileContent );
      foreach( $linesFound as $lineNumber => $lineContent ) {
        // Add title of pattern, content of line and matched pattern to array
        $matchedLinesArray[] = array( 'lineNumber'    => $lineNumber + 1,
                                      'type'          => $patterns[1],
                                      'match'         => trim( $lineContent ),
                                      'pattern'       => $patterns[0]
                                    );
      }
  }
  return $matchedLinesArray;
}

function isInvalidReferenceError( $msg ) { if( substr( $msg, 0, 18 ) === 'invalid reference:' ) { return true; } else { return false; } }
function isMermaidError( $msg ) { if( $msg === 'invalid style for listing block: mermaid' ) { return true; } else { return false; } }


function validateTests( $tests ) {
  $failed = false;

  foreach( $tests as $type => $failures ) {
    // asciidoctor is the exception. contains both errors and warnings and some warnings must not lead to failed=true
    if( $type == 'asciidoctor' ) {
      foreach ( $failures as $i => $asciidoctorError ) {
        // if Warning is about invalid_reference, do not fail but continue loop
        if( $asciidoctorError['severity'] == 'WARN' ) {
          if( isInvalidReferenceError( $asciidoctorError['message'] ) ) {
            continue;
          }
          else {
            $failed = true;
            break;
          }
        } else {
            $failed = true;
            break;
        }
      }
    }
    elseif( $type == 'anchors' ) {
      foreach ( $failures as $i => $anchorsError ) {
        // if just missing anchor don't refuse build but warn
        if( $anchorsError['severity'] == 'WARN' ) {
            continue;
        } else {
            $failed = true;
            break;
        }
      }
    }
    // all other tests
    else {
      // if there is more than 0 errors in a test overall failed=true
      if( sizeof( $failures ) > 0 ){
        $failed = true;
        break;
      }
    }
  }
  return $failed;
}

function postprocessErrors( $testsResultsArray, $indexedFiles ) {

  // remove mermaid errors for now. TODO: have asciidoctor diagram inside js asciidoc helper, so there are no such errors
  foreach( $testsResultsArray as $tr ) {
    foreach( $tr['tests']['asciidoctor'] as $e => $adError ) {
      if( isMermaidError( $adError['message'] ) ) {
        unset($testsResultsArray['index.adoc']['tests']['asciidoctor'][$e]);
        continue;
      }
    }
  }

  if( array_key_exists( 'index.adoc', $testsResultsArray ) === false ) return $testsResultsArray;

  $invalidReferencesArray = array();

  // get all asciidoctor errors and add them to the corresponding file entry in the tests results list
  // index == filename
  foreach( $testsResultsArray['index.adoc']['tests']['asciidoctor'] as $e => $adError ) {
    $filename = $adError['filename'];
    // skip file search for invalid references if not in index
    if( $filename !== 'index.adoc' )
      $testsResultsArray[$filename]['tests']['asciidoctor'][] = $adError;

    // if it is an invalid reference error add it to the pile that we use later to search the files with
    if( isInvalidReferenceError( $adError['message'] ) ) {
      $invalidReferenceID = str_replace( 'invalid reference: ', '', $adError['message'] );
      // make sure this is not a false positive created by asciidoctor by searching all anchors (contained in ['index.adoc']['anchors'])
      if( array_key_exists( $invalidReferenceID, $testsResultsArray['index.adoc']['anchors'] ) === false ) {
        $invalidReferencesArray[] = $invalidReferenceID;
      }
    }
  }

  // take all invalid reference errors
  //  - they do not contain any info in which file they are
  //  - they are only valid if they occur in scope of index.adoc
  //  - we must therefore scan all individual files for them

  $invalidReferencesArray = array_unique( $invalidReferencesArray );

  $pool = new Pool( 50 );

  foreach( $testsResultsArray as $filename => $value ) {
    if( in_array( $filename, $indexedFiles ) === false ) {
      continue;
    }
    $searchFileTask = new SearchFileTask( $filename, $invalidReferencesArray );
    $searchFileTasksArray[$filename] = $searchFileTask;
    $pool->submit( $searchFileTask );
  }

  while( $pool->collect() );
  $pool->shutdown();

  foreach( $searchFileTasksArray as $filename => $t ) {
    $results = $t->getFoundReferences();
    // add invalid reference error to file
    foreach( $results as $r ) {
      if( array_key_exists( 'filename', $testsResultsArray[$filename] ) === false ) $testsResultsArray[$filename]['filename'] = $filename;
      if( array_key_exists( 'branch', $testsResultsArray[$filename] ) === false ) $testsResultsArray[$filename]['branch'] = getBranchOfFile( $filename );
      if( array_key_exists( 'author', $testsResultsArray[$filename] ) === false ) $testsResultsArray[$filename]['author'] = getLastEditedByOfFile( $filename );
      $testsResultsArray[$filename]['tests']['asciidoctor'][] = array(
                                                                      'severity'   => 'WARN',
                                                                      'filename'   => $filename,
                                                                      'message'    => 'invalid reference: '.$r['reference'],
                                                                      // what we were doing all this for... just to get the line number
                                                                      'lineNumber' => $r['lineNumber']
                                                                      );
    }
  }
  // remove empty entries from results
  foreach( $testsResultsArray as $filename => $value ) {
    $numErrors = 0;
    foreach( $testsResultsArray[$filename]['tests'] as $test ) {
      if( sizeof( $test ) > 0 ) $numErrors++;
    }
    if( $numErrors == 0 ) unset( $testsResultsArray[$filename] );
  }
  // remove index.adoc from results after adding all error messages to their files
  unset( $testsResultsArray['index.adoc'] );

  return $testsResultsArray;
}


// Sends notifications to (for now) Slack
// Take Webhook from ENV
function sendNotifications ( $results ) {
  if( empty(getenv( 'SLACK_TOKEN' )) ) {
    echo "Environment Var SLACK_TOKEN not set -> output to console";
  }
  $currentBranch = getCurrentBranch();
  $commitAuthor = getCommitAuthor();
  $slackWebhookUrl = 'https://hooks.slack.com/services/'.getenv( 'SLACK_TOKEN' );
  if( sizeof( $results ) > 0 ) {
    foreach( $results as $filename => $result ) {
      $slackMessage = createSlackMessageFromErrors( $result, $currentBranch, $commitAuthor );
      if( $slackMessage !== false )
        $status = postToSlack( $slackWebhookUrl, $slackMessage );
    }
  }
  else {
    // empty error array creates "success" msg in createSlackMessageFromErrors
    $slackMessage = createSlackMessageFromErrors( array(), $currentBranch, $commitAuthor );
    if( $slackMessage !== false )
      $status = postToSlack( $slackWebhookUrl, $slackMessage );
  }
  return true;
}

// creates a single error message
function createSlackMessageFromErrors( $result, $currentBranch, $commitAuthor ) {

  $numErrors = 0;
  if( sizeof( $result ) > 0 ){
    $filename = $result['filename'];
    $branch = $result['branch'];
    $author = $result['author'];
    if( $branch == PULL_REQUEST_BRANCH ) {
      $githubLink = 'https://github.com/wirecard/merchant-documentation-gateway/pulls';
    }
    else {
      $githubLink = 'https://github.com/wirecard/merchant-documentation-gateway/blob/'.$currentBranch.'/'.$filename;
    }
    $slackMessage = array( 'attachments' => array(array(
                             'pretext'     => '*'.$filename.'* (<'.$githubLink.'|Github Link>)PHP_EOLLast edited by: *'.$author.'*PHP_EOLBranch: *'.$currentBranch.'*PHP_EOLCommit from: *'.$commitAuthor.'*',
                             'mrkdwn_in'   => [ 'text', 'pretext' ]
                              ))
                          );
    if( array_key_exists( 'anchors', $result['tests'] ) && sizeof( $result['tests']['anchors'] ) > 0 ){
      $slackItem = array( 'title' => 'Anchors', 'text' => '', 'mrkdwn_in' => [ 'text', 'pretext' ] );
      foreach( $result['tests']['anchors'] as $key => $test ) {
        if( $test['errorType'] == 'format')
          $slackItem['text'] .= $test['errorMessage'].': `'.$test['anchorID'].'`PHP_EOL';
        else
          $slackItem['text'] .= $test['errorMessage'].': `'.$test['anchorText'].'`PHP_EOL';
      }
      $numErrors += sizeof( $result['tests']['anchors'] );
      $slackMessage['attachments'][] = $slackItem;
    }

    if( array_key_exists( 'patterns', $result['tests'] ) && sizeof( $result['tests']['patterns'] ) > 0 ){
      $slackItem = array( 'title' => 'Patterns', 'text' => '', 'mrkdwn_in' => [ 'text', 'pretext' ] );
      foreach( $result['tests']['patterns'] as $key => $test ) {
        $slackItem['text'] .= 'Line '.$test['lineNumber'].': '.$test['type'].': "'.$test['match'].'"PHP_EOL';
      }
      $numErrors += sizeof( $result['tests']['patterns'] );
      $slackMessage['attachments'][] = $slackItem;
    }

    if( array_key_exists( 'links', $result['tests'] ) && sizeof( $result['tests']['links'] ) > 0 ){
      $slackItem = array( 'title' => 'Links', 'text' => '', 'mrkdwn_in' => [ 'text', 'pretext' ] );
      foreach( $result['tests']['links'] as $key => $test ) {
        $slackItem['text'] .= $test['httpErrorMessage'].' (`'.$test['httpStatusCode'].'`) for `'.$test['url'].'`PHP_EOL';
      }
      $numErrors += sizeof( $result['tests']['links'] );
      $slackMessage['attachments'][] = $slackItem;
    }

    if( array_key_exists( 'asciidoctor', $result['tests'] ) && sizeof( $result['tests']['asciidoctor'] ) > 0 ){
      $slackItem = array( 'title' => 'Asciidoctor Diagnosis', 'text' => '', 'mrkdwn_in' => [ 'text', 'pretext' ] );
      foreach( $result['tests']['asciidoctor'] as $key => $test ) {
        $testMessage = ucfirst( preg_replace( '/(.*:\ )(.*)$/', '$1`$2`', $test['message'] ) );
        $slackItem['text'] .= 'Line '.$test['lineNumber'].': '.$testMessage.'PHP_EOL';
      }
      $numErrors += sizeof( $result['tests']['asciidoctor'] );
      $slackMessage['attachments'][] = $slackItem;
    }
  } else {
    $slackMessage = array( 'attachments' => array(array(
                             'pretext'     => 'Branch: *'.$currentBranch.'* (<https://github.com/wirecard/merchant-documentation-gateway/tree/'.$currentBranch.'|Github Link>)PHP_EOLCommit from: *'.$commitAuthor.'*',
                             'mrkdwn_in'   => [ 'text', 'pretext' ]
                              ))
                          );
    $slackItem = array( 'title' => 'Success!', 'text' => 'No errors found in '.$currentBranch.'. 😊', 'mrkdwn_in' => [ 'text', 'pretext' ] );
    $slackMessage['attachments'][] = $slackItem;
  }
  return $slackMessage;
}

function postToSlack( $slackWebhookUrl, $slackMessage ) {
  $messageString = str_replace('PHP_EOL', '\n', json_encode( $slackMessage, JSON_PRETTY_PRINT ) );
  if( empty(getenv( 'SLACK_TOKEN' )) ) {
    echo $messageString;
    return true;
  }

  $result = exec( "python3 buildscripts/util/post-to-slack.py '".$messageString."'" );
  return $result;
}

function main() {
  putenv( 'LC_ALL=C' );
  putenv( 'RUBYOPT="-E utf-8"' );

  $exitCode = 0;
  $numConcurrentThreads = 8;

  $adocFilesArray = glob( '*.adoc' );

  $indexedFiles = preg_filter( '/^include::([A-Za-z0-9_-]+\.adoc).*/', '$1', file( 'index.adoc', FILE_IGNORE_NEW_LINES ) );

  $pool = new Pool( $numConcurrentThreads );

  $numOfAdocFiles = sizeof( $adocFilesArray );
  for( $i = 0; $i < $numOfAdocFiles; ++$i ) {
    $task = new Task( $adocFilesArray[$i] );
    $tasksArray[$adocFilesArray[$i]] = $task;
    $pool->submit( $task );
  }
  while( $pool->collect() );
  $pool->shutdown();

  // See if there is a error that warrants abort of build process, then set exit code 1
  foreach( $tasksArray as $filename => $t ) {
    $testsResult = $t->getResults();
    if( validateTests( $testsResult['tests'] ) === true )
      $exitCode = 1;

    $testsResultsArray[$filename] = $testsResult;
  }

  $finalResults = postprocessErrors( $testsResultsArray, $indexedFiles );
  sendNotifications( $finalResults );

  return $exitCode;
}

return main();
