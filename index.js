const puppeteer = require('puppeteer');
const fs = require('fs');
const express = require('express');
const { resolve } = require('path');
const { info } = require('console');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'))
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
require('pretty-console-colors');
// http://localhost or
// http://localhost/ - they're the same or /#
const SPASitemapGenerator = (() => {

    let browser = null;
    let page = null;
    let frontier = {};
    let queue = [];
    let counter = 0;

    const publicAPI = {
        async start (browserConfig) {
            await startBrowser(browserConfig);
            return this;
        },
        async crawl(url) {
            await crawl(url);
            return this;
        },
        async writeFile(fileName) {
            writeFile(fileName);
            return this;
        },
        async stop() {
            await browser.close();
            return this;
        }
    };

    async function startBrowser(browserConfig) {
        console.info('✔️ Starting the browser');

        try {
            browser = await puppeteer.launch(browserConfig);
            browser.on('disconnected', () => {
                browser = null;
                console.info('✔️ Browser has been closed');
            });
            console.info('✔️ the browser has been opened');
            page = await browser.newPage();
            console.info('✔️ the page has been opened');
        } catch (err) {
            console.error('❌ Failed to start the browser', err);
            process.exit();
        }
        return;
    }

    async function collectLinksFromPage() {
        let links = [];

        try {
            console.info('✔️ Collection of links has started');
            links = await page.$$eval('a', (linkTag) => {
                const links = [];
                linkTag.forEach((element) => {
                    if (element && element.href) {
                        links.push(element.href);
                    }
                })
                return links;
            });
            console.info('✔️ Collection of links has finished');
        } catch (error) {
            return new Promise((resolve, reject) => {
                console.error('❌ Error of collecting the links', error);
                reject(error);
            });
        }

        return new Promise((resolve, reject) => {
            resolve(links);
        });
    }

    function writeFile (fileName) {
        console.log('writing a file');
        let data = [];
        for (let link in frontier) {
            if (frontier.hasOwnProperty(link)) {
                data.push(link);
            }
        }
        fs.writeFile(fileName, JSON.stringify(data), (err, data) => {
            if (err) throw new Error(err);
            process.exit();
        });
    }

    async function crawl(url) {
        if (!browser) {
            console.error('❌ The generator has not been kicked in');
            process.exit();
        }

        console.info('✔️ Crawl has been started');
        frontier[url] = 0;
        queue.push(url);

        while (queue.length) {
            console.log('✔️ Loop has started');
            try {
                await processPage();
            } catch (err) {
                console.error('❌ Error occured during crawl process', err);
                console.log('✔️ Forced writing on the disk has been initiated');
                writeFile('preserved-data.json');
                process.exit();
            }
            console.log(`Links have been processed: ${++counter}`);
            break;
        }
        console.log('Loop has ended');
        return;
    }

    async function processPage() {
        console.log('Page processing has started');
        let link = queue.shift();

        if (frontier.hasOwnProperty(link) && !frontier[link]) {

            try {
                console.log('Page transition started');
                await page.goto(link, {
                    waitUntil: 'domcontentloaded',
                });
            } catch (err) {
                console.log('Error during page transition', err);
                process.exit();
            }

            console.log('Start: waitForSelector');
            await page.waitForSelector('a');
            console.log('End: waitForSelector');

            const unfilteredLinks = await collectLinksFromPage();

            const filteredLinks = [];

            unfilteredLinks.forEach((link) => {
                // if (link.match(new RegExp('^https\:\/\/alligator\.io\/.*'))) {
                    filteredLinks.push(link);
                // }
            });

            filteredLinks.forEach((link) => {
                console.log('link', link);
                if (!frontier.hasOwnProperty(link)) {
                    frontier[link] = 0;
                    queue.push(link);
                }
            });

            frontier[link] = 1;
        }
    }


    return publicAPI;
});



(async () => {
    const generator = await SPASitemapGenerator().start({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    // await generator.stop();
    await generator.crawl('http://localhost:3000');
})();
