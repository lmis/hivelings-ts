declare const require: (url: string) => string;

export const loadAsset = async (url: string): Promise<HTMLImageElement> => {
  const img = new Image();
  const promise = new Promise<HTMLImageElement>((resolve) => {
    img.onload = () => resolve(img);
  });
  img.src = require("../../../public/assets/" + url);
  return promise;
};

export const loadAssets = async (descriptors: {
  [name: string]: string;
}): Promise<{ [name: string]: HTMLImageElement }> =>
  (
    await Promise.all(
      Object.entries(descriptors).map(
        async ([name, url]) =>
          [name, await loadAsset(url)] as [string, HTMLImageElement]
      )
    )
  ).reduce((acc, [name, image]) => ({ ...acc, [name]: image }), {});
