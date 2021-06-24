/*
 * screenshot function
 *
 * Example invocation:
 *
 * screenshot({
 *  page: await browser.newPage(),
 *  context: {
 *    url: 'https://example.com',
 *    type: 'jpeg',
 *    quality: 50,
 *    fullPage: false,
 *    omitBackground: true,
 * },
 * });
 *
 * @param args - object - An object with a puppeteer page object, and context.
 * @param args.page - object - Puppeteer's page object (from await browser.newPage)
 * @param args.context - object - An object of parameters that the function is called with. See src/schemas.ts
 */
module.exports = async function screenshot({ page, context } = {}) {
  const {
    authenticate = null,
    addScriptTag = [],
    addStyleTag = [],
    url = null,
    cookies = [],
    gotoOptions,
    html = '',
    userAgent = '',
    manipulate = null,
    options = {},
    rejectRequestPattern = [],
    rejectResourceTypes = [],
    requestInterceptors = [],
    setExtraHTTPHeaders = null,
    setJavaScriptEnabled = null,
    viewport,
    waitFor,
    waitForFunction,
  } = context;

  if (authenticate) {
    await page.authenticate(authenticate);
  }

  if (setExtraHTTPHeaders) {
    await page.setExtraHTTPHeaders(setExtraHTTPHeaders);
  }

  if (setJavaScriptEnabled !== null) {
    await page.setJavaScriptEnabled(setJavaScriptEnabled);
  }

  if (
    rejectRequestPattern.length ||
    requestInterceptors.length ||
    rejectResourceTypes.length
  ) {
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      if (
        !!rejectRequestPattern.find((pattern) => req.url().match(pattern)) ||
        rejectResourceTypes.includes(req.resourceType())
      ) {
        return req.abort();
      }
      const interceptor = requestInterceptors.find((r) =>
        req.url().match(r.pattern),
      );
      if (interceptor) {
        return req.respond(interceptor.response);
      }
      return req.continue();
    });
  }

  if (cookies.length) {
    await page.setCookie(...cookies);
  }

  if (viewport) {
    await page.setViewport(viewport);
  }

  if (userAgent) {
    await page.setUserAgent(userAgent);
  }

  let response = null;

  // Disable page timeout
  await page.setDefaultNavigationTimeout(0);
  await page.setDefaultTimeout(0);

  if (url !== null) {
    response = await page.goto(url, gotoOptions);
  } else {
    // Whilst there is no way of waiting for all requests to finish with setContent,
    // you can simulate a webrequest this way
    // see issue for more details: https://github.com/GoogleChrome/puppeteer/issues/728

    await page.setRequestInterception(true);
    page.once('request', (request) => {
      request.respond({ body: html });
      page.on('request', (request) => request.continue());
    });

    response = await page.goto('http://localhost', gotoOptions);
  }

  if (addStyleTag.length) {
    for (tag in addStyleTag) {
      await page.addStyleTag(addStyleTag[tag]);
    }
  }

  if (addScriptTag.length) {
    for (script in addScriptTag) {
      await page.addScriptTag(addScriptTag[script]);
    }
  }

  if (waitFor) {
    if (typeof waitFor === 'string') {
      const isSelector = await page.evaluate((s) => {
        try {
          document.createDocumentFragment().querySelector(s);
        } catch (e) {
          return false;
        }
        return true;
      }, waitFor);

      await (isSelector
        ? page.waitForSelector(waitFor)
        : page.evaluate(`(${waitFor})()`));
    } else {
      await new Promise((r) => setTimeout(r, waitFor));
    }
  } else if (waitForFunction && typeof waitForFunction === 'string') {
    await page.waitForFunction(waitForFunction);
  }

  const data = await page.screenshot(options);

  const headers = {
    'x-response-url': response?.url().substring(0, 1000),
    'x-response-code': response?.status(),
    'x-response-status': response?.statusText(),
    'x-response-ip': response?.remoteAddress().ip,
    'x-response-port': response?.remoteAddress().port,
  };

  if (manipulate) {
    const sharp = require('sharp');
    const chain = sharp(data);

    if (manipulate.resize) {
      chain.resize(manipulate.resize);
    }

    if (manipulate.flip) {
      chain.flip();
    }

    if (manipulate.flop) {
      chain.flop();
    }

    if (manipulate.rotate) {
      chain.rotate(manipulate.rotate);
    }

    return {
      data: await chain.toBuffer(),
      headers,
      type: options.type ? options.type : 'png',
    };
  }

  return {
    data,
    headers,
    type: options.type ? options.type : 'png',
  };
};
