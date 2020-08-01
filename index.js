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

    /**
     * Starts a browser and opens a page
     * @param {Object} browserConfig - config for the puppeteer launch function.
     * See doc https://pptr.dev/#?product=Puppeteer&version=v5.2.1&show=api-puppeteerlaunchoptions
     * @return {void}
     */
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
            process.on('exit', (code) => {
                console.log('CODE', code);
                if (code === 130) {
                    console.warn('Critical file writing');
                    writeFile('critical.json');
                }
            });
        } catch (err) {
            console.error('❌ Failed to start the browser', err);
            process.exit();
        }
        return;
    }

    /**
     * Collect links from the page and return the list
     * @return {Promise} the list of links collected from the page
     */
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

    /**
     * @param {String} file - file name
     * @return {void}
     */
    function writeFile(file) {
        console.info('✔️ writing a file');
        let data = [];

        /**
         * Collect key values from the frontier, i.e. links
         */
        for (let link in frontier) {
            if (frontier.hasOwnProperty(link)) {
                data.push(link);
            }
        }
        console.log('data', data);
        fs.writeFile(file, JSON.stringify(data), (err, data) => {
            console.info('START');
            if (err) throw new Error(err);
            console.info('✔️ File has been successfully written');
            process.exit();
        });
    }

    /**
     * @param {String} url - URL where to start to crawl
     * @return {this}
     */
    async function crawl(url) {
        if (!browser) {
            console.error('❌ The generator has not been kicked in');
            process.exit();
        }

        console.info('✔️ Crawl has been started');
        addLink(url);

        while (queue.length) {
            let link = queue.shift();
            try {
                await processPage(link);
            } catch (err) {
                console.error('❌ Error occured during crawl process', err);
                writeFile('preserved-data.json');
            }
            console.info(`${++counter} links have been processed`);
            // break;
        }
        console.info('✔️ Loop has ended');
        return this;
    }

    async function processPage(link) {
        console.info(`✔️ Page processing has started at URL ${link}`);

        if (frontier.hasOwnProperty(link) && !frontier[link]) {

            try {
                await page.goto(link, {
                    waitUntil: 'domcontentloaded',
                });
            } catch (err) {
                console.error('❌ Error during page transition', err);
                process.exit();
            }

            await page.waitForSelector('a');

            const unfilteredLinks = await collectLinksFromPage();

            const filteredLinks = [];

            unfilteredLinks.forEach((link) => {
                filteredLinks.push(link);
            });

            filteredLinks.forEach((link) => {
                console.log('link', link);
                if (!frontier.hasOwnProperty(link)) {
                    addLink(link);
                }
            });

            frontier[link] = 1;
        }
    }

    function addLink(url) {
        frontier[url] = 0;
        queue.push(url);
    }


    return publicAPI;
});



(async () => {
    const generator = await SPASitemapGenerator().start({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    // await generator.stop();
    await generator.crawl('http://localhost:3000/');
    await generator.writeFile('test.json');
})();
