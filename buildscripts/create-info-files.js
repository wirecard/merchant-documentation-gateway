/*
* Creates git-info file to be used with build scripts.
* Contains
* - name of author of last commit
* - branch name (or "Pull_Request")
*/

const fs = require('fs');
const infoFilesFile = 'buildscripts/info-files.json';
const childProcess = require('child_process');

function readInfoFile(file) {
    var fileContents;
    try {
        fileContents = fs.readFileSync(file);
        JsonObject = JSON.parse(fileContents);
    }
    catch (err) {
        throw err;
    }
    return JsonObject;
}

function writeGitInfo(data) {
    try {
        fs.writeFileSync(infoFiles['git-info-file'], JSON.stringify(data, null, 2));
    }
    catch (err) {
        throw err;
    }
}

function getCommitAuthor() {
    const commitAuthor = 'git log -1 --pretty=format:%an';
    return childProcess.execSync(commitAuthor).toString().trim();
}

function getCurrentBranch() {
    const cmd_git_branch = 'git name-rev --name-only HEAD';
    // trim removes line break after branch name
    const currentBranch = childProcess.execSync(cmd_git_branch).toString().trim();
    if (currentBranch.length == 0) return 'Pull_Request';
    return currentBranch;
}

const infoFiles = readInfoFile(infoFilesFile);

const gitData = {
    "commit_author": getCommitAuthor(),
    "branch": getCurrentBranch()
};

writeGitInfo(gitData);
