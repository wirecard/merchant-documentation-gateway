<?php // php -d display_errors=1

/*
Tests all .adoc files in current folder for errors using asciidoctor. Treat warnings as errors.
Get branch / task ID from git log where available.
Use multithreading with thread pool to speed up the process.

                                                  herbert.knapp@wirecard.com
*/
error_reporting( E_ALL );
set_error_handler( 'exceptions_error_handler' );
const testNoErrorPath = true;

function size_check(string $text, string $appendText, int $maxSize=2000) {
  return (strlen($text) + strlen($appendText) <= $maxSize);
}

function exceptions_error_handler( $severity, $message, $filename, $lineNo ) {
  if ( error_reporting() == 0 ) {
    return;
  }
  if ( error_reporting() & $severity ) {
    throw new ErrorException( $message, 0, $severity, $filename, $lineNo );
  }
}

$CI = new stdClass();
$CI->travis = (getenv('TRAVIS') == 'true');
$CI->pull_request_number = (getenv('TRAVIS_PULL_REQUEST') !== false && getenv('TRAVIS_PULL_REQUEST') !== 'false') ? getenv('TRAVIS_PULL_REQUEST') : false;
$CI->pull_request_branch = (getenv('TRAVIS_PULL_REQUEST_BRANCH') !== false && getenv('TRAVIS_PULL_REQUEST_BRANCH') !== '') ? getenv('TRAVIS_PULL_REQUEST_BRANCH') : false;

const URLTEST_MAXRETRIES = 3;
const INFO_FILE = "buildscripts/info-files.json";

class Task extends Threaded {
  private $threadID;
  private $filename;
  private $result;

  public function __construct( string $filename ) {
    $this->filename = $filename;
  }

  public function run() {

    $asciidoctorOutput = getAsciidoctorOutput( $this->filename );
    if(!$asciidoctorOutput) {
      echo "calling asciidoctor helper failed for ".$this->filename.PHP_EOL;
      die();
    }
    // filter http links
    $asciidoctorOutput['links'] = preg_grep( '/^https?:/', $asciidoctorOutput['links'] );
    $gitBranch = getBranchOfFile( $this->filename );
    $gitAuthor = GitInfo::getInstance()->getLastEditedByOfFile( $this->filename );

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
    $statusCode = 0;
    $attempts = 0;
    while ($attempts <= URLTEST_MAXRETRIES && $statusCode === 0) {
      error_reporting(E_ALL & ~E_WARNING);
      $h = get_headers( $this->url );
      error_reporting(E_ALL);
      $statusCode = ($h) ? intval( substr( $h[0], 9, 3 ) ) : 0;
      if($statusCode === 0) sleep(2);
      $attempts++;
    }
    $this->httpStatusCode = $statusCode;
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

class GitInfo {
  private static $instance;
  private $gitInfoArray;

  private function __construct() {
    $infoFiles = json_decode(file_get_contents(INFO_FILE), true);
    try {
      $gitInfoFileContent = file_get_contents($infoFiles['git-info-file']);
      $gitInfo = json_decode($gitInfoFileContent, true);
    }
    catch (exception $e) {
      echo "Error: could not read " . INFO_FILE;
      die();
    }
    $this->gitInfoArray = array(
      'commit_author' => $gitInfo['commit_author'],
      'branch' => $gitInfo['branch'],
      'commit_hash' => $gitInfo['commit_hash'],
      'files' => $gitInfo['files']
    );
  }
  private function __clone() {}

  public static function getInstance() {
      if (!GitInfo::$instance instanceof self) {
        GitInfo::$instance = new self();
      }
      return GitInfo::$instance;
  }
  public function getCommitAuthor() {
      return $this->gitInfoArray['commit_author'];
  }
  public function getBranch() {
    return $this->gitInfoArray['branch'];
  }
  public function getCommitHash() {
      return $this->gitInfoArray['commit_hash'];
  }
  public function getLastEditedByOfFile($file) {
    if (array_key_exists('last_edited_by', $this->gitInfoArray['files'][$file])) {
      $lastEditedBy = $this->gitInfoArray['files'][$file]['last_edited_by'];
    }
    else {
      $lastEditedBy = '';
    }
    return $lastEditedBy;
  }
  public function getInfoArray() {
    return $this->gitInfoArray;
  }
}

// instance here to abort early if reading of info files failed
GitInfo::getInstance();

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
  //DISABLED. Not in use.
  return '';

  $cmd_origin = 'git --no-pager log --decorate=short --pretty=oneline --follow -- "' . $filename
                . '" | sed -n "s/.*(origin\/\(' . $pattern . '\)).*/\1/p" | head -n 1';
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

  $asciidoctorJSON = shell_exec( 'node buildscripts/tests/asciidoctor-helper.js --file "'.$filename.'"' );
  if(!$asciidoctorJSON) {
    return false;
  }
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
      if( array_key_exists( 'author', $testsResultsArray[$filename] ) === false ) $testsResultsArray[$filename]['author'] = GitInfo::getInstance()->getLastEditedByOfFile( $filename );
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
  global $CI; // don't look. global. i know.

  // Gather information
  if( !empty(getenv('DEBUG')) )
    echo "DEBUG for messaging is ".getenv('DEBUG')."\n";
  if( empty(getenv( 'SLACK_TOKEN' )) )
    echo "Environment Var SLACK_TOKEN not set -> output to console\n";

  $partner = getenv( 'PARTNER' );
  $currentBranch = $CI->pull_request_branch === false ? GitInfo::getInstance()->getBranch() : $CI->pull_request_branch;
  $commitAuthor = GitInfo::getInstance()->getCommitAuthor();
  $commitHash = GitInfo::getInstance()->getCommitHash();
  $slackWebhookUrl = 'https://hooks.slack.com/services/'.getenv( 'SLACK_TOKEN' );

  // Slack message
  if($CI->pull_request_branch !== false) {
    $headerText = "*Pull Request for:* ".$currentBranch
    ." (<https://github.com/wirecard/merchant-documentation-gateway/pull/".$CI->pull_request_number."|On Github>)PHP_EOL";
  }
  else {
    $headerText = "*Branch:* ".$currentBranch
    ." (<https://github.com/wirecard/merchant-documentation-gateway/tree/".$currentBranch."|On Github>)PHP_EOL"; 
  }
  $headerText = $headerText."*Commit:* `".$commitHash
  ."` (<https://github.com/wirecard/merchant-documentation-gateway/commit/".$commitHash."|On Github)>PHP_EOL"
  ."*Commit from:* ".$commitAuthor."PHP_EOL"
  ."*Partner:* ".$partner."PHP_EOL";
  $msgOpening = array(array("type" => "section", "text" => array("type" => "mrkdwn", "text" => $headerText)),
                      array("type" => "divider"),
                      );
  $msgContent = null;
  $msgsContent = array();
  $sectionTemplate = array("type" => "section",
                           "fields" => array());
  if( testNoErrorPath && sizeof( $results ) > 0 ) {
    $msgContent = $sectionTemplate;
    $msgCount = 0;
    foreach( $results as $filename => $result ) {
      if( getenv('DEBUG') === "TRUE" || getenv('DEBUG') === "YES" || getenv('DEBUG') === "1" ) {
        echo "*** ".$filename."\n";
        echo json_encode($result, JSON_PRETTY_PRINT)."\n";
      }
      if(!isset($result['filename']))
        $result['filename'] = $filename;
      if(!isset($result['branch']))
        $result['branch'] = "whitelabel";
      if($CI->pull_request_branch !== false)
        $result['branch'] = $CI->pull_request_branch;
      if(!isset($result['author']))
        $result['author'] = "redacted";
      $msgContent["fields"][] = createSlackMessageFromErrors( $result, $partner, $currentBranch, $commitAuthor, $commitHash );
      $msgCount++;
      if($msgCount % 10 === 0) {
        $msgsContent[] = $msgContent;
        $msgContent = $sectionTemplate;
      }
    }
    // add missing content if msgCount % 10
    if($msgCount % 10)
      $msgsContent[] = $msgContent;
  }
  else {
    // empty error array creates "success" msg in createSlackMessageFromErrors
    $msgsContent = array(createSlackMessageFromErrors( array(), $partner, $currentBranch, $commitAuthor, $commitHash ));
  }

  $msgClosing = array(array("type" => "divider"),
                      array("type" => "context",
                            "elements" => array(array("type" => "mrkdwn",
                                                      "text" => "I'm C.I. Travis, and I approve this message. "
                                                      ."<https://travis-ci.com/wirecard/merchant-documentation-gateway/builds|Vote for me!>"))),
                      array("type" => "divider")
                      );


  $slackMessage = $msgOpening;
  // TODO: change this to iterate over msgContents in array since we need to split sections with 10+ fields
  foreach($msgsContent as $msgContent)
    array_push($slackMessage, $msgContent);
  foreach($msgClosing as $closingItem)
    array_push($slackMessage, $closingItem);
  $status = postToSlack( $slackWebhookUrl, array("blocks" => $slackMessage) );
  return true;
}

// creates a single error message
function createSlackMessageFromErrors( $result, $partner, $currentBranch, $commitAuthor, $commitHash ) {
  global $CI;
  
  $numErrors = 0;
  if( testNoErrorPath && sizeof( $result ) > 0 ){
    $filename = $result['filename'];
    $branch = $result['branch'];
    $lastEditedAuthor = $result['author'];
    if( $branch == $CI->pull_request_branch ) {
      $githubLink = 'https://github.com/wirecard/merchant-documentation-gateway/pull/'.$CI->pull_request_number;
    }
    else {
      $githubLink = 'https://github.com/wirecard/merchant-documentation-gateway/blob/'.$currentBranch.'/'.$filename;
    }

    $content = array("type" => "mrkdwn", "text" => "*File*: ".$filename." (<".$githubLink."|On Github>)"."PHP_EOL"
                      ."*Last edited by:* ".$lastEditedAuthor."PHP_EOL");
    if( array_key_exists( 'anchors', $result['tests'] ) && sizeof( $result['tests']['anchors'] ) > 0 ){
      $content['text'] .= "• *Anchors*"."PHP_EOL";
      foreach( $result['tests']['anchors'] as $key => $test ) {
        if( $test['errorType'] == 'format')
          $appendTxt = "```".$test['errorMessage'].": ".$test['anchorID']."```PHP_EOL";
        else
          $appendTxt = "```".$test['errorMessage'].": ".$test['anchorText']."```PHP_EOL";
        if(!size_check($content['text'], $appendTxt))
          break;
        $content['text'] .= $appendTxt;
      }
      $numErrors += sizeof( $result['tests']['anchors'] );
    }

    if( array_key_exists( 'patterns', $result['tests'] ) && sizeof( $result['tests']['patterns'] ) > 0
      && strlen($content['text'] < 2000) ) {
      $content['text'] .= "• *Patterns*"."PHP_EOL";
      foreach( $result['tests']['patterns'] as $key => $test ) {
        $appendTxt = "```Line ".$test['lineNumber'].": ".$test['type'].": \"".$test['match']."\"```PHP_EOL";
        if(!size_check($content['text'], $appendTxt))
          break;
        $content['text'] .= $appendTxt;
      }
      $numErrors += sizeof( $result['tests']['patterns'] );
    }

    if( array_key_exists( 'links', $result['tests'] ) && sizeof( $result['tests']['links'] ) > 0 
      && strlen($content['text'] < 2000) ) {
      $content['text'] .= "• *Links*"."PHP_EOL";
      foreach( $result['tests']['links'] as $key => $test ) {
        $appendTxt = "```".$test['httpErrorMessage']." (".$test['httpStatusCode'].") for ".$test['url']."```PHP_EOL";
        if(!size_check($content['text'], $appendTxt))
          break;
        $content['text'] .= $appendTxt;
      }
      $numErrors += sizeof( $result['tests']['links'] );
    }

    if( array_key_exists( 'asciidoctor', $result['tests'] ) && sizeof( $result['tests']['asciidoctor'] ) > 0
    && strlen($content['text'] < 2000) ) {
      $content['text'] .= "• *Asciidoctor Diagnosis*"."PHP_EOL";
      foreach( $result['tests']['asciidoctor'] as $key => $test ) {
        $testMessage = ucfirst( preg_replace( '/(.*:\ )(.*)$/', '$1`$2`', $test['message'] ) );
        $appendTxt = "```Line ".$test['lineNumber'].": ".$testMessage."```PHP_EOL";
        if(!size_check($content['text'], $appendTxt))
          break;
        $content['text'] .= $appendTxt;
      }
      $numErrors += sizeof( $result['tests']['asciidoctor'] );
    }
  } else {
    $content = array("type" => "section",
                    "text" => array("type" => "plain_text",
                                    "text" => "No errors found! Well done, ".$commitAuthor."! :smile:",
                                    "emoji" => true));
  }
  return $content;
}

function postToSlack( $slackWebhookUrl, $slackMessage ) {
  $messageString = str_replace('PHP_EOL', '\n', json_encode( $slackMessage, JSON_PRETTY_PRINT ) );
  if( empty(getenv( 'SLACK_TOKEN' ))) {
    echo $messageString."\n";
  }

  if(!empty(getenv('SKIP_SLACK_MESSAGE')))
    return true;

  $descriptorspec = array(
      0 => array('pipe', 'r'),  // stdin
      1 => array('pipe', 'w'),  // stdout
      2 => array('pipe', 'w')   // stderr
      // 2 => array('file', tempnam(sys_get_temp_dir(), "post-to-slack-error"), 'a')   // stderr
  );

  $cwd = getcwd();
  $env = array('SLACK_TOKEN' => getenv('SLACK_TOKEN'), 'PATH' => getenv('PATH'));
  if(PHP_OS_FAMILY === 'Windows') {
    $env['PYTHONIOENCODING'] = 'UTF-8';
  }
  $command = ((PHP_OS_FAMILY === 'Windows') ? 'python' : 'python3') . ' buildscripts/util/post-to-slack.py';
  
  $process = proc_open($command, $descriptorspec, $pipes, $cwd, $env);
  
  $result = "result not available";
  if (is_resource($process)) {
      fwrite($pipes[0], $messageString);
      fclose($pipes[0]);
  
      $result = stream_get_contents($pipes[1]);
      $errors = stream_get_contents($pipes[2]);
      if ($result !== '') {
        echo("######### POST-TO-SLACK ############\n");
        echo($result."\n");
        echo("####################################\n");
      }
      if ($errors !== '') {
        echo("############# ERRORS ###############\n");
        echo($errors."\n");
        echo("####################################\n");
      }
      fclose($pipes[1]);
      fclose($pipes[2]);
      $return_value = proc_close($process);
  } else {
    echo("[!] failed to create process for post-to-slack");
  }
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
