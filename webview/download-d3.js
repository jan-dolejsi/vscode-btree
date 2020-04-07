//@ts-check

const download = require('download-file');

const url = "https://unpkg.com/d3@5.15.0/dist/d3.min.js";
// const url = "https://unpkg.com/d3-hierarchy@1.1.8/dist/d3-hierarchy.min.js";

const options = {
    directory: "out",
    filename: "d3.min.js"
};

console.log("Installing " + options.directory + "/" + options.filename);

download(url, options, function (error) {
    if (error) {
        throw error;
    }
});