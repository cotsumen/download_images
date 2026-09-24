const getAbsoluteUrl = src => {
  const base = window.location.origin;
  let url;

  if (src == false) {
    url = src;
  } else if (src.startsWith("http://") || src.startsWith("https://")) {
    url = src;
  } else if (src.startsWith("//")) {
    url = `${window.location.protocol}${src}`;
  } else if (src.startsWith("/")) {
    url = `${base}${src}`;
  } else {
    url = new URL(src, base).href;
  }

  return url.split('?').shift();
}

const checkExtension = src => {
  const path = src.split('?').shift();

  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|avif)$/i.test(path);
}

const checkFormat = src => {
  if (/;base64,/.test(src) == true) {
    return false;
  } else {
    return checkExtension(src);
  }
};

const getImageList = () => {
  const list = new Set([...document.querySelectorAll('img')].map(img => {
    let src = "";

    if (img.srcset) {
      src = img.srcset.split(/w,\s*/).map(srcset => {
        const [url, size] = srcset.trim().split(/\s+/);
        return {
          url : url,
          size : parseInt(size, 10) || 0
        };
      }).reduce((a,c) => {
        return a.size < c.size ? c : a;
      }, { url: "", size: 0 }).url;
    }

    if (src == "" && img.src) {
      src = img.src;
    }

    //TODO: srcがBASE64の場合
    if (/;base64,/.test(src) == true) {

    }

    return checkExtension(src) ? getAbsoluteUrl(src) : "";

  }));
  return [...list].filter(v => v != false);
};

const counter = (() => {
  var count = 0;
  return {
    add : (p=1) => {
      count += p;
      return count;
    },
    sub : (p=1) => {
      count -= p;
      return (count < 0) ? 0 : count;
    },
    reset : () => {
      count = 0;
      return count;
    }
  };
})();

const getMimeType = url => {
  const path = new URL(url).pathname.split('?').pop();
  const ext = path.split('.').pop();
  let mime;

  switch (ext) {
    case 'jpg':
    case 'jpeg': 
      mime = "image/jpeg";
      break;
    case 'png':
      mime = "image/png";
      break;
    case 'gif':
      mime = "image/gif";
      break;
    case 'webp':
      mime = "image/webp";
      break;
    case 'svg':
      mime = "image/svg+xml";
      break;
    case 'bmp':
      mime = "image/bmp";
      break;
    case 'tiff':
      mime = "image/tiff";
      break;
    case 'avif':
      mime = "image/avif";
      break;
  }
  return mime;
};

const base64ToBlob = (enc, mime) => {
  const bin = atob(enc);

  const bytes = new Uint8Array(bin.length);
  for (let i=0; i<bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'REQUEST':
      const list = getImageList();
      sendResponse({
        data: list
      });
      break;
    case 'GENERATE':
      if (message.data && message.data.length > 0) {
        const list =  message.data.map(async entry => {
          const blob = base64ToBlob(entry.blob, getMimeType(entry.url)); 
          const data = {
            name : entry.url.split('/').slice(-1)[0],
            blob : URL.createObjectURL(blob)
          }

          return data;
        });

        Promise.all(list).then(result => {
          chrome.runtime.sendMessage(
            {
              action: 'DOWNLOAD',
              data: result
            },
            response => {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
              }
              result.forEach(data => {
                URL.revokeObjectURL(data.blob);
              });
            }
          );

          sendResponse({
            result:true
          });
        }).catch(error => {
          console.error(error);

          sendResponse({
            result:false
          });
        });
      } else {
        sendResponse({
          result:false
        });
      }
      return true;
      break;
  }
});

