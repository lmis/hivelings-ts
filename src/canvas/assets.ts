declare const require: (url: string) => string;

export const loadAsset = async (url: string): Promise<HTMLImageElement> => {
  const img = new Image();
  const promise = new Promise<HTMLImageElement>(resolve => {
    img.onload = () => resolve(img);
  });
  // The section here is a workaround to load static assets using codesandbox.
  // Ideally, you'd want to load your assets from a static server and wait or
  // fallback in case they are not available. Codesandbox does not seem to
  // expose something like that with the simple serverless sandboxes.
  // Instead, we `require` the assets here.
  img.src = require("../../../public/assets/" + url);
  return promise;
};

export const loadAssets = async (descriptors: {
  [name: string]: string;
}): Promise<{ [name: string]: HTMLImageElement } | null> => {
  try {
    const assets = await Promise.all(
      Object.entries(descriptors).map(
        async ([name, url]) =>
          [name, await loadAsset(url)] as [string, HTMLImageElement]
      )
    );
    return assets.reduce(
      (acc, [name, image]) => ({ ...acc, [name]: image }),
      {}
    );
  } catch (e) {
    return Promise.resolve(null);
  }
};
