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

const requestPermission = path => {
  const url = new URL(path);
  const origin = url.origin;
  return new Promise((resolve, reject) => {
    chrome.permissions.request({
      origins: [`${origin}/*`]
    }, (granted) => {
      if (granted) {
        resolve(true);
      } else {
        reject(false);
      }
    });
  });
};

const blobToBase64 = blob => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'REQUEST':
      //content_scriptsにページ内の全imgタグの有効なsrc値一覧を要求
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true
        },
        tabs => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                action: 'REQUEST'
              },
              response => {
                if (chrome.runtime.lastError) {
                  console.error(chrome.runtime.lastError);
                } else {
                  sendResponse({
                      action: "REPLY",
                      data: response.data
                  });
                }
              } 
            );
          }
        }
      );
      break;
    case 'RELAY':
      //popupで選択した画像パス一覧からCORS対策でSERVICE_WORKER側で画像のBLOBを生成
      if (message.data && message.data.length > 0) {
        const list = message.data.map(async url => {
          const data = {
            url: url,
            blob: null
          };
          let res;
          try {
            res = await fetch(url);
          } catch (e) {
            //fetch失敗したらhost_permissionsをユーザに許可申請したからの再取得
            const granted = await requestPermissions(url);
            if (granted == true) {
              res = await fetch(url);
            }
          }
          if (res) {
            //取得したデータからblob抽出してBASE64エンコード
            const blob = await res.blob();
            data.blob  = await blobToBase64(blob);
          }
          return data;
        });

        //非同期でfetch＞blob＞base64が完了したらcontent_scriptsにダウンロード用のBlobとURLの生成要求
        Promise.all(list).then(result => {
          chrome.tabs.query(
            {
              active: true,
              currentWindow: true
            },
            tabs => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  {
                    action: 'GENERATE',
                    data: result
                  },
                  response => {
                    sendResponse({
                      result: (chrome.runtime.lastError) ? false : response.result
                    });
                  }
                );
              }
            }
          );
        }).catch(e => {
          console.error(e);
        });
      }
      break;
    case 'DOWNLOAD':
      //ダウンロード用のBlobとURL一覧が送られてきたら
      if (message.data && message.data.length > 0) {
        console.log('DOWNLOAD REQUEST');
        console.log(message.data);
        const data = message.data.shift();
        const counting = delta => {
          if (delta.state && delta.state.current == 'complete') {
            const count = counter.add();
            if (message.data.length <= count) {
              if (chrome.downloads.onChanged.hasListener(counting) == true) {
                chrome.downloads.onChanged.removeListener(counting);
                counter.reset();
              }
              sendResponse({
                  action: "REVOKE"
              });
            }
          }
        };
        const remain = delta => {
          if (delta.state && delta.state.current == 'complete') {
            if (chrome.downloads.onChanged.hasListener(remain) == true) {
              chrome.downloads.onChanged.removeListener(remain);
            }

            chrome.downloads.search(
              { id: delta.id },
              results => {
                if (results.length > 0) {
                  const dir = results[0].filename.split('/').slice(4, -1).join('/');
                  chrome.downloads.onChanged.addListener(counting);

                  message.data.forEach((data, i) => {
                    const name = data.name;
                    try {
                      chrome.downloads.download({
                        url: data.blob,
                        filename: `${dir}/${name}`, 
                        conflictAction: 'uniquify',
                        saveAs: false
                      });
                    } catch (e) {
                      console.error(e);
                    }
                  });
                }
              }
            );
            
          }
        };

        chrome.downloads.onChanged.addListener(remain);

        chrome.downloads.download({
          url: data.blob,
          filename: data.name, 
          conflictAction: 'uniquify',
          saveAs: true
        });
      }
      break;
    default:
      break;
  }
  return true;
});
