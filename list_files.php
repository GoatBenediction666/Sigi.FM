<?php
$directory = 'musics/';
$files = array();

if (is_dir($directory)) {
    if ($dh = opendir($directory)) {
        while (($file = readdir($dh)) !== false) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'mp3') {
                $files[] = $file;
            }
        }
        closedir($dh);
    }
}

echo json_encode($files);
?>