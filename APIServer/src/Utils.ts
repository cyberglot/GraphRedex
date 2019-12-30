import { spawn } from "child_process";
import * as fs from "fs";
import express = require("express");

export function isReadableFile(absPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        fs.access(absPath, fs.constants.R_OK, (err) => {
            resolve(err ? false : true);
        });
    });
}

export function deleteDir(
    absPath: string,
    recursive: boolean = false,
): Promise<boolean> {
    if (recursive) {
        return new Promise((resolve, reject) => {
            const args = [
                "-r", // treat ALL files as text
                "--", // never overwrite existing files
                absPath, // path
            ];
            console.log("rm", args);
            const child = spawn("rm", args, {
                env: { LC_ALL: "C" },
                stdio: ["pipe", "pipe", "pipe"],
            });

            child.stdout.on("data", (data) => {
                console.log(`stdout: ${data}`);
            });

            child.stderr.on("data", (data) => {
                console.log(`err: ${data}`);
            });

            child.on("error", reject);

            child.on("close", (code) => {
                console.log(`rm exited with code ${code}`);
                if (code === 0) {
                    resolve(true);
                } else {
                    reject(false);
                }
            });
        });
    } else {
        return new Promise((resolve, reject) => {
            fs.rmdir(absPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(false);
                }
            });
        });
    }
}

export function dirListing(path: string): Promise<fs.Dirent[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(path, { withFileTypes: true }, (err, files: fs.Dirent[]) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

export function asyncMiddleware(fn: express.RequestHandler) {
    return (req: express.Request, res: express.Response, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export function makeEnv(...overwrites: Object[]) {
    const filteredEnv = Object.keys(process.env)
        .filter(
            (k /* Keep useful vars */) =>
                ["ARANGO_SERVER", "ARANGO_PORT"].includes(k) ||
                k.startsWith("GRAPHREDEX_"),
        )
        .reduce((res, key) => ((res[key] = process.env[key]), res), {});
    return Object.assign({}, filteredEnv, ...overwrites);
}
