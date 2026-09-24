const toggle = (flag, target, value) => {
  if (flag == true) {
    if (target.classList.contains(value) == false) {
      target.classList.add(value);
    }
  } else {
    if (target.classList.contains(value) == true) {
      target.classList.remove(value);
    }
  }
}

const generateHTML = value => {
    const template = document.createElement('template');
    template.innerHTML = value.trim();
    return template.content.firstElementChild;
}

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

document.addEventListener('DOMContentLoaded', () => {
  const request = document.getElementById('request');
  const download = document.getElementById('download');

  request.addEventListener('click', e => {
    e.preventDefault();
    const container = document.getElementById('main');

    container.replaceChildren();
    toggle(true, document.body, 'loading');
    counter.reset();

    chrome.runtime.sendMessage({
      action: 'REQUEST'
    },
    response => {
      if (chrome.runtime.lastError) {
        const error = document.getElementById('error');
        error.insertAdjacentHTML('beforeend', chrome.runtime.lastError);
        error.classList.add('is');
      } else {
        if (response && response.action == 'REPLY' && response.data.length > 0) {
          response.data.forEach((v, i) => {
            const block = generateHTML(`<li><input type="checkbox" value="${i}" /><img src="${v}"></li>`);

            block.querySelector('img').addEventListener('load', e => {
              const count = counter.add();
              const width = Math.ceil(count/response.data.length*460)+'px';
              
              document.documentElement.style.setProperty('--loading-progress', width);

              if (response.data.length <= count) {
                download.disabled = false;
                setTimeout(() => {
                  toggle(false, document.body, 'loading');
                }, 1000);
              }
            });
            block.querySelector('img').addEventListener('error', e => {
              console.error(`${e.target.src}`);
            });

            container.appendChild(block);

          });

        }
      }
    });
  });

  download.addEventListener('click', e => {
    e.preventDefault();

    const list = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(e => e.nextElementSibling.src);

    chrome.runtime.sendMessage(
      {
        action: "RELAY",
        data: list
      },
      response => {
        if (chrome.runtime.lastError) {
          const error = document.getElementById('error');
          error.insertAdjacentHTML('beforeend', chrome.runtime.lastError);
          error.classList.add('is');
        } else {
          console.log(`DOWNLOAD RESULT: ${response.result}`);
        }
      }
    );
  });
});


