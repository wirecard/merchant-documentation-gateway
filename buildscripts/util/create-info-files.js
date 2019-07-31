/*
* Creates git-info file to be used with build scripts.
* Contains
* - name of author of last commit
* - branch name (or "Pull_Request")
* - list of files (only adoc currently) containing
*   - last_edited_by
*   - originating branch (disabled)
*/
/*jshint esversion: 6*/

const fs = require('fs');
const infoFilesFile = 'buildscripts/info-files.json';
const childProcess = require('child_process');

const gitCommands = function (file, branchPattern = 'PSPDOC-[0-9]\+') {
    const git = {
        'current_branch': 'git name-rev --name-only HEAD',
        'commit_author': 'git log -1 --pretty=format:%an',
        'commit_hash': 'git rev-parse HEAD',
        'last_edited_by': 'git log -1 --pretty=format:%an -- "' + file + '"',
        'branch_of_file': 'git --no-pager log --decorate=short --pretty=oneline --follow -- "' + file + '" | sed -n "s/.*(origin\/\(' + branchPattern + '\)).*/\1/p" | head -n 1'
    }
    return git;
}

function readInfoFile(file) {
    var fileContents;
    var JsonObject;
    try {
        fileContents = fs.readFileSync(file);
        JsonObject = JSON.parse(fileContents);
    }
    catch (err) {
        throw err;
    }
    return JsonObject;
}

function getAllFilesInFolder(folderPath = './', fileList) {
    var files = fs.readdirSync(folderPath);
    fileList = fileList || [];
    files.forEach(function (file) {
        if (fs.statSync(folderPath + file).isDirectory()) {
            fileList = getAllFilesInFolder(folderPath + file + '/', fileList);
        }
        else {
            //if (!folderPath.match(/^\.\/\.git/)) {
            if( file.match(/\.adoc$/)) {
                fileList.push(folderPath + file);
            }
        }
    });
    return fileList;
}

const infoFiles = readInfoFile(infoFilesFile);
function writeGitInfo() {
    const gitData = {
        "commit_author": getCommitAuthor(),
        "branch": getCurrentBranch(),
        "commit_hash": getCurrentHash(),
        "files": gitFilesInformation
    };
    try {
        fs.writeFileSync(infoFiles['git-info-file'], JSON.stringify(gitData, null, 2));
    }
    catch (err) {
        throw err;
    }
}

function getCommitAuthor() {
    const cmdGitCommitAuthor = gitCommands()['commit_author'];
    return childProcess.execSync(cmdGitCommitAuthor).toString().trim();
}

function getCurrentHash() {
    const cmdGitCommitAuthor = gitCommands()['commit_hash'];
    return childProcess.execSync(cmdGitCommitAuthor).toString().trim();
}

function getCurrentBranch() {
    const cmdGitBranch = gitCommands()['current_branch'];
    // trim removes line break after branch name
    const currentBranch = childProcess.execSync(cmdGitBranch).toString().trim();
    if (currentBranch.length == 0) {
        return 'Pull_Request';
    }
    return currentBranch;
}

var gitFilesInformation = {};
function addGitInfo(file, entry, info) {
    file = file.replace(/^.\//, '');
    if (typeof gitFilesInformation[file] === 'undefined') {
        gitFilesInformation[file] = {};
    }
    gitFilesInformation[file][entry] = info;
}

function runGitCommand(file, type) {
    return new Promise(function (resolve) {
        childProcess.exec(gitCommands(file)[type], function (err, stdout, stderr) {
            if (err) {
                console.log(stderr);
                throw (err);
            } else {
                addGitInfo(file, type, stdout);
                resolve();
            }
        });
    });
}

var promisesPromises = [];
const filesInDirectory = getAllFilesInFolder();
filesInDirectory.forEach(file => {
    promisesPromises.push(runGitCommand(file, 'last_edited_by'));
    //promisesPromises.push(runGitCommand(file, 'branch_of_file')); // disabled
});

Promise.all(promisesPromises)
    .then(() => {
        writeGitInfo();
        process.exit(0);
    });