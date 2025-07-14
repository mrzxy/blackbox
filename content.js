// 全局变量
let isMonitoring = false;
let monitoringInterval = null;

// Discord webhook URL
let DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1387993663837310996/Kuov6iYyG8nRaHzHjCaZcVbxlRvNQ82WwoXncU9i_e9sfQxuosgAgX919R22mDNMQQqO';
// DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1388056531026841620/9xVZst5BI3tTNfhTBpGrrPm8EyeYgeAI2ZQuE8yrd-OHnbJmTgHLSAhI0yDoX3O35RnO';

/**
 * 解析HTML表格行，提取期权数据
 * @param {HTMLElement} row - 表格行元素 (<tr>)
 * @returns {Array} 期权数据数组，格式为 [{"text": "值", "color": "颜色"}]
 */
function parseOptionsRowToData(row) {
    const data = [];
    
    try {
        // 获取所有的td元素
        const cells = row.querySelectorAll('td');
        
        cells.forEach((cell, index) => {
            // 获取单元格的文本内容
            let text = cell.innerText?.trim() || '';
            
            // 清理文本：移除多余的空白字符和换行
            text = text.replace(/\s+/g, ' ').trim();
            
            // 获取颜色样式
            let color = '#FFFFFF'; // 默认白色
            
            // 从style属性中获取颜色
            const styleColor = cell.style.color;
            if (styleColor && styleColor !== 'transparent' && styleColor !== '') {
                color = styleColor;
            }
            
            // 从CSS类或计算样式中获取颜色（如果style中没有）
            if (color === '#FFFFFF' || color === 'white') {
                const computedStyle = window.getComputedStyle(cell);
                const computedColor = computedStyle.color;
                if (computedColor && computedColor !== 'rgb(255, 255, 255)' && computedColor !== 'white') {
                    color = computedColor;
                }
            }
            
            // 标准化颜色格式
            color = normalizeColor(color);
            
            // 只添加有文本内容的单元格
            if (text && text.length > 0) {
                data.push({
                    text: text,
                    color: color
                });
            }
        });
        
        console.log('解析的期权数据:', data);
        return data;
        
    } catch (error) {
        console.error('解析期权行数据时出错:', error);
        return [];
    }
}

/**
 * 标准化颜色格式
 * @param {string} color - 原始颜色值
 * @returns {string} 标准化的颜色值
 */
function normalizeColor(color) {
    if (!color || color === 'transparent' || color === '') {
        return '#FFFFFF';
    }
    
    // 处理常见的颜色名称
    const colorMap = {
        'white': '#FFFFFF',
        'red': '#FF0000',
        'green': '#00FF00',
        'blue': '#0000FF',
        'yellow': '#FFFF00',
        'orange': '#FFA500',
        'purple': '#800080',
        'pink': '#FFC0CB',
        'cyan': '#00FFFF',
        'magenta': '#FF00FF',
        'lime': '#00FF00',
        'gold': '#FFD700'
    };
    
    // 转换为小写进行匹配
    const lowerColor = color.toLowerCase();
    if (colorMap[lowerColor]) {
        return colorMap[lowerColor];
    }
    
    // 处理rgb格式 rgb(255, 0, 0)
    const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        
        // 转换为十六进制
        const hex = '#' + 
            r.toString(16).padStart(2, '0') + 
            g.toString(16).padStart(2, '0') + 
            b.toString(16).padStart(2, '0');
        return hex.toUpperCase();
    }
    
    // 处理rgba格式 rgba(255, 0, 0, 1)
    const rgbaMatch = color.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/i);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        
        // 转换为十六进制
        const hex = '#' + 
            r.toString(16).padStart(2, '0') + 
            g.toString(16).padStart(2, '0') + 
            b.toString(16).padStart(2, '0');
        return hex.toUpperCase();
    }
    
    // 如果已经是十六进制格式，确保大写
    if (color.startsWith('#')) {
        return color.toUpperCase();
    }
    
    // 其他情况返回原值或默认白色
    return color || '#FFFFFF';
}



/**
 * 发送期权数据到MQTT
 * @param {Array} optionsData - 期权数据数组
 */
function sendOptionsDataToMQTT(optionsData) {
    try {
        const message = {
            data: optionsData,
            timestamp: Date.now(),
            source: 'blackbox_options_monitor'
        };
        
        console.log('准备发送MQTT消息:', message);
        
        // 使用已有的publishMsg函数发送到MQTT
        publishMsg('lis-msg/black_box', JSON.stringify(message));
        
    } catch (error) {
        console.error('发送MQTT消息时出错:', error);
    }
}

// 美东时间转换和判断函数

// 更精确的美东时间处理函数（考虑夏令时）
function isWithin10MinutesEST(estTimeString) {
  try {
    // 获取当前时间
    const now = new Date();
    
    // 解析时间字符串 "4:14:49"
    const [hours, minutes, seconds] = estTimeString.split(':').map(Number);
    
    // 拼上当前日期，创建完整的时间对象
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, seconds, 0);
    
    // 计算时间差（毫秒）
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    const tenMinutesInMs = 10 * 60 * 1000; // 10分钟的毫秒数
    
    // 判断是否在10分钟之内
    const isWithin10Min = timeDiff >= 0 && timeDiff <= tenMinutesInMs;
    
    return isWithin10Min;
  } catch (error) {
    console.error('时间转换错误:', error);
    return false;
  }
}

// 创建开始/暂停按钮
function createControlButton() {
  // 检查是否已存在按钮
  if (document.getElementById('blackbox-monitor-btn')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'blackbox-monitor-btn';
  button.textContent = '开始监听';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;

  // button.addEventListener('click', toggleMonitoring);
  button.addEventListener('click', () => {
    // domToImg(document.querySelector('#optionStrip .k-master-row'));
    // testParseOptionsRow(); // 测试解析函数
    toggleMonitoring()

  });
  document.body.appendChild(button);
}


// 切换监听状态
function toggleMonitoring() {
  const button = document.getElementById('blackbox-monitor-btn');
  
  if (isMonitoring) {
    // 停止监听
    stopMonitoring();
    button.textContent = '开始监听';
    button.style.backgroundColor = '#4CAF50';
  } else {
    // 开始监听
    startMonitoring();
    button.textContent = '暂停监听';
    button.style.backgroundColor = '#f44336';
  }
}

// 开始监听
function startMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  console.log('开始监听 BlackBox Options...');
  
  // 将当前列表的所有选项行标记为已处理
  const currentOptionRows = document.querySelectorAll('#optionStrip .k-master-row');
  currentOptionRows.forEach(row => {
    // row.setAttribute('data-issend', '1');
  });
  console.log(`已标记 ${currentOptionRows.length} 个当前选项行为已处理`);
  
  // 启动while循环监听
  startWhileLoop();
}

// while循环监听函数
async function startWhileLoop() {
  while (isMonitoring) {
    try {
      await processOptions();
      // 等待1秒
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('监听循环出错:', error);
      // 出错时也等待1秒再继续
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// 停止监听
function stopMonitoring() {
  isMonitoring = false;
  console.log('停止监听 BlackBox Options');
}

// 处理选项数据
async function processOptions() {
  const optionRows = document.querySelectorAll('#optionStrip .k-master-row');
  
  // 倒序循环处理选项行
  for (let i = optionRows.length - 1; i >= 0; i--) {
    const row = optionRows[i];
    
    if (!isMonitoring) {
      return
    }
    // 检查是否已经处理过
    if (row.getAttribute('data-issend') === '1') {
      continue;
    }

    // if (!isWithin10MinutesEST(row.querySelector('td.time').innerText)) {
    //   continue;
    // }

    try {
      // 解析期权数据
      const optionsData = parseOptionsRowToData(row);
      console.log(optionsData)
      
      if (optionsData.length > 0) {
        // 发送解析后的数据到MQTT
        publishMsg('lis-msg/black_box', {
          "data": optionsData,
          "timestamp": Date.now(),
          "source": "blackbox_options_monitor"
        });
        
        console.log('已发送期权数据到MQTT:', optionsData);
        
        // 可选：仍然截图
        // await domToImg(row);
      }

      // 标记为已处理
      row.setAttribute('data-issend', '1');
      console.log('已处理选项行:', row);
      
    } catch (error) {
      console.error('处理选项行时出错:', error);
    }
  }
}

// 发送图片到Discord
async function sendToDiscord(imageData, symbol = 'Unknown') {
  try {
    // 将base64图片数据转换为Blob
    const response = await fetch(imageData);
    const blob = await response.blob();
    
    // 创建FormData
    const formData = new FormData();
    formData.append('file', blob, `${symbol}_${Date.now()}.png`);
    
    // 添加消息内容
    const payload = {
      // content: `📊 **BlackBox Options Alert**\n\n**Symbol:** ${symbol}\n**Time:** ${new Date().toLocaleString('zh-CN')}\n**Source:** BlackBox Options Monitor`,
      // embeds: [{
      //   title: 'Options Data Captured',
      //   description: `Screenshot captured for ${symbol}`,
      //   color: 0x00ff00,
      //   timestamp: new Date().toISOString(),
      //   footer: {
      //     text: 'BlackBox Options Monitor'
      //   }
      // }]
    };
    
    formData.append('payload_json', JSON.stringify(payload));
    
    // 发送到Discord webhook
    const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      body: formData
    });
    
    if (discordResponse.ok) {
      console.log(`✅ 图片已成功发送到Discord: ${symbol}`);
      return true;
    } else {
      const errorText = await discordResponse.text();
      console.error(`❌ 发送到Discord失败: ${discordResponse.status} - ${errorText}`);
      return false;
    }
    
  } catch (error) {
    console.error('发送到Discord时出错:', error);
    return false;
  }
}

// 截图函数 - 你需要自己实现这个函数
async function domToImg(element) {
  return new Promise((resolve, reject) => {
    try {
      // 获取股票代码
      const symbol = element.getAttribute('data-symbol') || 'Unknown';
      
      // 使用 html2canvas 截图，提高分辨率
      html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#192026',
        scale: 8,                         // 增加放大倍数（原来是8，现在改为12）
        logging: false,                    // 关闭日志提升性能
        imageTimeout: 15000
      }).then(async canvas => {
       
        const imgData = canvas.toDataURL('image/png', 1.0); // 最高质量
        
        // 这里你可以处理图片数据
        // 比如保存到本地、上传到服务器等
        // console.log('截图完成:', imgDat);
        
        // 发送到Discord
        const success = await sendToDiscord(imgData, symbol);
        
        if (success) {
          console.log(`✅ ${symbol} 截图已发送到Discord`);
        } else {
          console.error(`❌ ${symbol} 截图发送失败`);
        }
        
        resolve(imgData);
      }).catch(error => {
        console.error('截图失败:', error);
        reject(error);
      });
    } catch (error) {
      console.error('domToImg 函数执行失败:', error);
      reject(error);
    }
  });
}

// 下载图片的辅助函数（可选）
function downloadImage(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 注入自定义CSS样式
function injectCustomStyles() {
  // 检查是否已经注入过样式
  if (document.getElementById('blackbox-custom-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'blackbox-custom-styles';
  style.textContent = `
    #optionStrip .k-grid-table {
      font-weight: bold !important;
      font-size: 14px !important;
    }
  `;
  
  document.head.appendChild(style);
  console.log('自定义CSS样式已注入');
}

// 页面加载完成后初始化
function init() {
  // 注入自定义样式
  injectCustomStyles();
  
  // 等待页面完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createControlButton();
      injectCustomStyles(); // 确保样式已注入
    });
  } else {
    createControlButton();
    injectCustomStyles(); // 确保样式已注入
  }
  
  // 监听页面变化（如果页面是动态加载的）
  const observer = new MutationObserver(() => {
    if (!document.getElementById('blackbox-monitor-btn')) {
      createControlButton();
    }
  
    // 确保样式始终存在
    if (!document.getElementById('blackbox-custom-styles')) {
      injectCustomStyles();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function getReactPropsName(domElement) {
  for (var key in domElement) {
    // 判断属性名是否以 "__reactProps" 开头，如果是则返回该属性名
    if (key.startsWith("__reactProps")) {
      return key;
    }
  }
  // 如果未找到对应的属性名，则返回 null
  return null;
}

function getRandomNum() {
  return Math.floor(Math.random() * 100000) + 1;
}
function connectMqtt() {
    const url = 'wss://f24a5dcf.ala.cn-hangzhou.emqxsl.cn:8084/mqtt'
    let role = "t3_listener"
    // Create an MQTT client instance
    const options = {
        // Clean session
        clean: true,
        connectTimeout: 4000,
        // Authentication
        clientId: role + '_' + getRandomNum(),
        username: 'dcaccount',
        password: 'f24a5dcf123',
    }
    const client = mqtt.connect(url, options)
    client.on('connect', function () {
        console.log(`${client.username} connected!`)
    })


    return client
}

let client = connectMqtt()

function publishMsg(topic, content) {
    if (client.connected) {
        return client.publish(topic, JSON.stringify(content), {
            qos: 1,
        }, (err) => {
            if (err) {
                console.error(error)
            }
        })
    } else {
        console.log("mqtt not connected")
    }
    return false
}
// 启动插件
init(); 