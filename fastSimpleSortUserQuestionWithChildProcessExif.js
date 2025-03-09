const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

const rootDir = process.cwd();
const filesWithoutHandleDir = path.join(rootDir, 'filesWithoutHandle');
const mediaRootDir = path.join(rootDir, 'FamilienMedien');
const dataRootDir = path.join(rootDir, 'FamilienDaten');
const unableToSortDir = path.join(rootDir, 'unableToSort');

let unableToSortExtensions = new Set();
const MAX_CHILD_PROCESSES = 6;
let activeChildProcesses = 0;
const taskQueue = [];

console.log("Starting script...");

function createDirectories() {
    console.log("Creating directories...");
    [filesWithoutHandleDir, mediaRootDir, dataRootDir, unableToSortDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    for (let year = 1950; year <= 2025; year++) {
        [mediaRootDir, dataRootDir].forEach(root => {
            const yearDir = path.join(root, year.toString());
            if (!fs.existsSync(yearDir)) {
                fs.mkdirSync(yearDir, { recursive: true });
            }
            for (let month = 1; month <= 12; month++) {
                const monthDir = path.join(yearDir, month.toString().padStart(2, '0'));
                if (!fs.existsSync(monthDir)) {
                    fs.mkdirSync(monthDir, { recursive: true });
                }
            }
        });
    }
    console.log("Directories created.");
}

function handleUserInput(prompt, callback) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(prompt, (answer) => {
        if (answer.toLowerCase() === 'y') {
            console.log('Terminating process as per user input.');
        } else {
            console.log('Continuing process as per user input.');
        }
        rl.close();
        callback();
    });
}

function getRandomLetter() {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    return letters[Math.floor(Math.random() * letters.length)];
}

function move(origin, destination) {
    let targetPath = destination;

    // check if the origin and destination are the same
    if (origin === destination) {
        console.log(`No Moving: origin and destination are the exact same: ${origin}`);
        return;
    }

    while (fs.existsSync(targetPath)) {
        const parsedPath = path.parse(targetPath);
        targetPath = path.join(parsedPath.dir, `${parsedPath.name}${getRandomLetter()}${parsedPath.ext}`);
    }
    try {
        fs.renameSync(origin, targetPath);
        // if the targetpath included unableToSort call unableToSortExtensions.add("extension");
        if(targetPath.includes("unableToSort")){
            unableToSortExtensions.add(path.extname(targetPath));
        }
    } catch (error) {
        if (error.code === 'EPERM') {
            console.error(`Skipping file due to permission error: ${error.message}`);
            unableToSortExtensions.add(path.extname(origin).toLowerCase());
            console.log(`No Moving has been done: ${origin}`);
            return;
        } else {
            throw error;
        }
    }
    console.log(`Moved: ${origin} to ${targetPath}`);
}

function getMediaCreatedDate(filePath, callback) {
    console.log(`Running exiftool for file: ${filePath}`);
    const exifProcess = exec(`exiftool -time:all -a -G1 -s "${filePath.replace(/\\/g, '\\\\')}"`, (error, stdout, stderr) => {
        if (error) {
            // make output colourful
            console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------');
            console.log('\x1b[31m%s\x1b[0m', '-------------------------Error-------------------------');
            console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------');
            console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------');
            console.error('\x1b[31m%s\x1b[0m', `Error getting media created date for file: ${filePath}`, error);
            console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------');
            console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------');
            console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------');
            // rename the file by adding the extension to the unableToSort folder
            move(filePath, path.join(unableToSortDir, path.basename(filePath)));
            callback(null);
            return;
        }
        console.log(`Exiftool output for file: ${filePath}: ${stdout}`);

        const datePattern = /(\d{4}:\d{2}:\d{2})/g;
        let match;
        let dates = [];

        while ((match = datePattern.exec(stdout)) !== null) {
            const dateStr = match[1].replace(/:/g, '-');
            const date = new Date(dateStr);
            if (!isNaN(date)) {
                dates.push(date);
                console.log(`Parsed date: ${date}`);
            } else {
                console.log(`Invalid date: ${dateStr}`);
            }
        }

        if (dates.length > 0) {
            const earliestDate = new Date(Math.min(...dates.map(date => date.getTime())));
            callback(earliestDate);
        } else {
            callback(null);
        }
    });

    const timeout = setTimeout(() => {
        exifProcess.kill();
        console.error(`Exiftool process timed out for file: ${filePath}`);
        handleUserInput(`Process timed out for file: ${filePath}. Do you want to terminate the process? (y/n)`, () => {
            callback(null);
        });
    }, 30000); // 30 seconds timeout

    exifProcess.on('exit', () => {
        clearTimeout(timeout);
    });
}

function processFile(filePath, file) {
    if (file === 'fastSimpleSortUserQuestionWithChildProcessExif.js' || file === 'exiftool.exe'|| file === "sortingLog.txt") {
        console.log(`Skipping file: ${file}`);
        activeChildProcesses--;
        processNextTask();
        return;
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(file).toLowerCase();
    const mediaExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', // Image formats
        '.avi', '.mp4', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.3g2', // Video formats
        '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.mid', '.midi', '.rmi', // Audio formats
        '.asf', '.asx', '.wax', '.wvx', '.wpl', '.dvr-ms', '.ivf', '.m2ts', // Windows-specific formats
        '.aup3', '.webm', '.flac', '.m4b', '.m4p', '.m4r', '.m4v', '.mkv', '.mov', '.mp3', '.mp4', '.mpg', '.ogg', 
        '.opus', '.png', '.psd', '.svg', '.swf', '.tif', '.tiff', '.wav', '.webm', '.webp', '.dng', // Additional media formats
        '.dng', '.icc', '.m3u', '.aif', '.amr', '.ogv', '.jp2', '.eps', '.emf', '.ai', '.cdr'
    ];

    if (!stats.isDirectory()) {
        console.log(`Processing file: ${filePath} with extension: ${ext}`);

        if (mediaExtensions.includes(ext)) {
            getMediaCreatedDate(filePath, (earliestDate) => {
                // check if the file at the filepath still exists, since it could have been moved to unableToSort because of an error in exiftool
                if (!fs.existsSync(filePath)) {
                    console.log(`File does not exist: ${filePath}`);
                    activeChildProcesses--;
                    processNextTask();
                    return;
                }
                if (!earliestDate) {
                    console.log('Unable to get media created date, using file system dates');
                    const dates = [stats.birthtime, stats.mtime, stats.ctime];
                    earliestDate = new Date(Math.min(...dates.map(date => date.getTime())));
                }

                console.log('File properties:', { creationDate: earliestDate });
                moveFileBasedOnDate(filePath, file, earliestDate, ext);
            });
        } else {
            console.log('File type does not support EXIF metadata, using file system dates');
            const dates = [stats.birthtime, stats.mtime, stats.ctime];
            const earliestDate = new Date(Math.min(...dates.map(date => date.getTime())));
            console.log('File properties:', { creationDate: earliestDate });
            moveFileBasedOnDate(filePath, file, earliestDate, ext);
        }
    }
}

function moveFileBasedOnDate(filePath, file, earliestDate, ext) {
    const year = earliestDate.getFullYear();
    const month = (earliestDate.getMonth() + 1).toString().padStart(2, '0');
    const mediaExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', // Image formats
        '.avi', '.mp4', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.3g2', // Video formats
        '.mp3', '.wav', '.flac', '.aac', '.m4a', '.wma', '.ogg', '.mid', '.midi', '.rmi', // Audio formats
        '.asf', '.asx', '.wax', '.wvx', '.wmx', '.wpl', '.dvr-ms', '.wmd', '.ivf', '.m2ts', // Windows-specific formats
        '.aup3', '.webm', '.flac', '.m4b', '.m4p', '.m4r', '.m4v', '.mkv', '.mov', '.mp3', '.mp4', '.mpg', '.ogg', 
        '.opus', '.png', '.psd', '.svg', '.swf', '.tif', '.tiff', '.wav', '.webm', '.webp', '.wmv', '.dng', // Additional media formats
        '.dng', '.icc', '.mobi', '.m3u', '.aif', '.amr', '.ogv', '.jp2', '.eps', '.emf', '.ai', '.cdr', '.lit', '.prproj', '.ps', '.wmf'
    ];
    const dataExtensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp',
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.html', '.css', '.htm', '.php', '.swf', '.sxw', '.kmz', '.epub', '.tif', '.ics',
        '.steuer2020', '.pages', '.sqlite', '.json', '.xml', '.toe', // Additional data formats
        '.mbox', '.plist', '.qgs', '.RData', '.tex', '.lyx', '.sav', '.shp', '.vsd'
    ];

    const targetRootDir = mediaExtensions.includes(ext) ? mediaRootDir : dataExtensions.includes(ext) ? dataRootDir : unableToSortDir;

    let targetDir = targetRootDir;
    if (!(targetRootDir.includes("unableToSort"))) {
        // log into logfile the filename as well as sorted
        fs.appendFileSync(path.join(rootDir, 'sortingLog.txt'), `${file}: sorted\n`);

        // if targetRootDir includes dataRootDir, add the extension after the date
        if(targetRootDir.includes(dataRootDir)){
            targetDir = path.join(targetRootDir, year.toString(), month, ext.substring(1));
        } else {
            targetDir = path.join(targetRootDir, year.toString(), month);
        }
    } else {
        // log into logfile the filename as well as unsorted
        fs.appendFileSync(path.join(rootDir, 'sortingLog.txt'), `${file}: unsorted\n`);

        if (/^\.\d+$/.test(ext)) {
            targetDir = path.join(targetRootDir, '_numberExtension');
        } else {
            targetDir = path.join(targetRootDir, ext.substring(1));
        }
    }

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`Moving file: ${filePath} to ${targetDir}`);
    move(filePath, path.join(targetDir, file));
    console.log('-------------------------------------------');
    activeChildProcesses--;
    processNextTask();
}

function processNextTask() {
    if (taskQueue.length > 0 && activeChildProcesses < MAX_CHILD_PROCESSES) {
        const { filePath, file } = taskQueue.shift();
        activeChildProcesses++;
        processFile(filePath, file);
    } else if (taskQueue.length === 0 && activeChildProcesses === 0) {
        console.log("All tasks completed.");
    }
}

function addTaskToQueue(filePath, file) {
    taskQueue.push({ filePath, file });
    processNextTask();
}

function checkDirectory(dir, log) {
    console.log(`Reading directory: ${dir}`);
    const files = fs.readdirSync(dir);
    console.log(`Found ${files.length} files in ${dir}`);

    files.forEach(file => {
        // check if file is in log and already sorted, use a try catch for undefined
        try {
            if (log[file] === 'sorted') {
                console.log(`File already sorted: ${file}`);
                return;
            } else if (log[file] === 'unsorted') {
                console.log(`File previously unsorted: ${file}`);
                console.log("Trying again..................");
            }
        } catch (error) {
            // skip
        }

        const filePath = path.join(dir, file);
        const folderName = path.basename(filePath);

        // Skip critical/vital folders
        const criticalFolders = [
            'System Volume Information', 'exiftool_files', 'node_modules', 'AppData', 'ProgramData',
            'Windows', 'Program Files', 'Program Files (x86)', 'Users', 'filesWithoutHandle',
            'System', 'Library', 'Applications', 'FamilienDaten', "high_prob_nsfw", "FamilienMedien", "FamilienDaten",
            'bin', 'boot', 'dev', 'etc', 'lib', 'proc', 'root', 'sbin', 'usr', 'var', 'neuralModelsForImageClassification', "$RECYCLE.BIN"
        ];

        if (criticalFolders.includes(folderName)) {
            console.log(`Skipping critical folder: ${folderName}`);
            return;
        }

        if (fs.statSync(filePath).isDirectory()) {
            checkDirectory(filePath);
        } else {
            addTaskToQueue(filePath, file);
        }
    });
}

function createLog() {
    if (!fs.existsSync(path.join(rootDir, 'sortingLog.txt'))) {
        fs.writeFileSync(path.join(rootDir, 'sortingLog.txt'), '');
    }
}

function readInLog() {
    // Check that log exists
    const logPath = path.join(rootDir, 'sortingLog.txt');
    if (!fs.existsSync(logPath)) {
        console.error("sortingLog.txt not found in root directory.");
        return;
    }

    // Read in log line by line into a hashmap using regex
    let log = {};
    const data = fs.readFileSync(logPath, 'utf8');
    const lines = data.split('\n');

    const regex = /^(.+):\s*(sorted|unsorted)$/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const fileName = match[1];
            const status = match[2];
            log[fileName] = status;
        }
    });

    console.log(`Log has ${Object.keys(log).length} entries`);
    // if log has zero entries, add a default entry into the log file and then recall this method
    if (Object.keys(log).length === 0) {
        fs.appendFileSync(logPath, `sortingLog.txt: sorted\n`);
        console.log("No entries in log file, added default entry and re-reading log file.");
        log = readInLog();
    }

    return log;
}

console.log("Running script...");
console.log("Starting directory creation...");
createDirectories();
console.log("Creating if not existent & Reading in sortingLog.txt at root");
createLog();
let log = readInLog();
console.log("Starting file sorting...");
checkDirectory('.', log);

// listener for Ctrl+Z to stop all processes
process.on('SIGTSTP', () => {
    console.log('Received SIGTSTP (Ctrl+Z). Stopping all processes...');
    process.exit();
});