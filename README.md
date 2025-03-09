# Exif_DataByDate_Sorting

### Abstract

This script is designed to help you organize your files into neatly structured directories based on their creation dates and file types. It automates the sorting process, making it much easier to manage and find your files.

First, the script sets up all the necessary directories, including year and month subdirectories from 1950 to 2025. It then processes each file by checking its extension and creation date. For media files, it uses EXIF metadata to determine the creation date, while for other files, it relies on the file system dates. Once the creation date is determined, the script moves the file to the appropriate directory, ensuring no duplicates by generating unique target paths if needed.

To keep things running smoothly, the script manages tasks using a queue system and limits the number of active child processes to prevent overload. It also maintains a log file to track which files have been sorted and which haven't, ensuring files are not processed multiple times.

Safety is a key consideration in this script. It skips critical system folders to avoid accidental modification or deletion of vital files. If it encounters permission errors, it handles them gracefully by moving problematic files to an "unableToSort" directory and logging the issue. The script sets timeouts for EXIF tool processes to prevent indefinite hangs and prompts the user for action if a timeout occurs. Additionally, it includes user input handling to allow manual intervention in case of errors or timeouts. Finally, the script listens for Ctrl+Z signals to stop all processes safely, ensuring no abrupt termination.

Overall, this script provides a robust and automated solution for file organization, with built-in safety measures to handle errors and prevent system disruptions.

--------------------------------------------------------------------------------------------

### Pseudocode

1. Import necessary modules: fs, path, exec, readline.
2. Define root directory and subdirectories.
3. Initialize variables: unableToSortExtensions, MAX_CHILD_PROCESSES, activeChildProcesses, taskQueue.
4. Print "Starting script..."

5. Function createDirectories:
    - Print "Creating directories..."
    - Create directories if they don't exist.
    - Create year and month subdirectories from 1950 to 2025.
    - Print "Directories created."

6. Function handleUserInput:
    - Create readline interface.
    - Prompt user for input.
    - Print message based on user input.
    - Close readline interface and execute callback.

7. Function getRandomLetter:
    - Return a random letter from 'a' to 'z'.

8. Function move:
    - Check if origin and destination are the same.
    - Generate unique target path if destination exists.
    - Rename file from origin to target path.
    - Handle permission errors and add extension to unableToSortExtensions if necessary.
    - Print moved file details.

9. Function getMediaCreatedDate:
    - Execute exiftool command to get media created date.
    - Handle errors and move file to unableToSort directory if necessary.
    - Parse dates from exiftool output.
    - Return earliest date or null via callback.
    - Set timeout for exiftool process and handle user input if process times out.

10. Function processFile:
    - Skip specific files.
    - Get file stats and extension.
    - Check if file is not a directory.
    - If file is a media file, get media created date and move file based on date.
    - If file is not a media file, use file system dates and move file based on date.

11. Function moveFileBasedOnDate:
    - Get year and month from earliest date.
    - Define media and data extensions.
    - Determine target root directory based on file extension.
    - Log file sorting status.
    - Create target directory if it doesn't exist.
    - Move file to target directory.
    - Print moved file details and process next task.

12. Function processNextTask:
    - Check if there are tasks in the queue and if active child processes are below the limit.
    - Process next task from the queue.
    - Print "All tasks completed" if queue is empty and no active child processes.

13. Function addTaskToQueue:
    - Add task to the queue.
    - Process next task.

14. Function checkDirectory:
    - Read directory and list files.
    - Skip critical folders.
    - Check if file is already sorted or unsorted.
    - Add file to task queue if not a directory.

15. Function createLog:
    - Create sorting log file if it doesn't exist.

16. Function readInLog:
    - Check if sorting log file exists.
    - Read log file line by line into a hashmap.
    - Add default entry to log file if no entries found.
    - Return log hashmap.

17. Main script execution:
    - Print "Running script..."
    - Create directories.
    - Create sorting log file if not existent.
    - Read sorting log file.
    - Start file sorting.
    - Listen for Ctrl+Z to stop all processes.


  
