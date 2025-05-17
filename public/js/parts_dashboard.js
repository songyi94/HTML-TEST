// js/parts_dashboard.js - 处理备件管理主页的动态逻辑

// --- 配置信息 ---
// 警告：API Token不应硬编码在前端，生产环境请务必采用更安全的方式管理。
const API_TOKEN = 'uskHcvUjPPwwLCVROw2N4qm'; // 使用用户提供的API Token
const PARTS_DATASHEET_ID = 'dstmlgTgra7TzChZ6X'; // 备件数据表ID
// 备件表中的字段名，用于Excel列名与API字段的映射
const PART_FIELDS = {
    name: 'Part_name',            // 备件名称
    description: 'Part_description', // 备件描述
    number: 'Part_number',          // 备件编号
    quantity: 'Part_quantity',      // 数量
    location: 'Part_location',      // 位置
    department: 'Part_department'   // 部门
};

// 当整个HTML文档加载完成并且DOM树构建完毕后执行回调函数
document.addEventListener('DOMContentLoaded', function() {
    const totalPartsCountElement = document.getElementById('totalPartsCount');
    const importExcelButton = document.getElementById('importExcelButton');
    const excelFileInput = document.getElementById('excelFileInput');
    
    // 获取进度条相关元素
    const importProgressArea = document.getElementById('importProgressArea');
    const importProgressBar = document.getElementById('importProgressBar');
    const importStatusText = document.getElementById('importStatusText');
    const importProgressPercent = document.getElementById('importProgressPercent');

    let totalRecordsForImport = 0; // 用于导入的总记录数
    let processedRecordsCount = 0; // 已处理的记录数

    // 加载备件总数
    loadTotalPartsCount();

    // --- 导入Excel功能 --- 
    if (importExcelButton && excelFileInput) {
        importExcelButton.addEventListener('click', function() {
            excelFileInput.click(); // 点击按钮时触发隐藏的文件输入框
        });

        excelFileInput.addEventListener('change', async function(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            // 检查是否已引入SheetJS库
            if (typeof XLSX === 'undefined') {
                alert('错误：Excel解析库 (SheetJS) 未加载。请检查HTML文件是否正确引入该库。');
                excelFileInput.value = ''; // 清空文件选择
                return;
            }

            const originalButtonText = importExcelButton.textContent;
            importExcelButton.disabled = true;
            importExcelButton.textContent = '处理中...';

            // 初始化并显示进度条
            importProgressArea.style.display = 'block'; // 显示进度条区域
            processedRecordsCount = 0;
            totalRecordsForImport = 0;
            updateProgressDisplay(0, 100, '正在准备导入...'); // 初始状态

            try {
                updateProgressDisplay(5, 100, '正在解析Excel文件...');
                const excelData = await parseExcelFile(file);
                if (!excelData || excelData.length === 0) {
                    alert('Excel文件为空或格式不正确。');
                    throw new Error('未从Excel解析到数据。');
                }
                updateProgressDisplay(20, 100, `成功解析 ${excelData.length} 条数据。正在从数据库获取现有记录...`);
                
                const existingVikaRecordsMap = await fetchAllVikaRecords( (progressMessage) => {
                    // fetchAllVikaRecords 内部可以调用这个回调来更新更细致的进度
                    updateProgressDisplay(20 + Math.round(progressMessage.current / progressMessage.total * 20), 100, `获取现有记录: ${progressMessage.text}`);
                });
                updateProgressDisplay(40, 100, `获取了 ${existingVikaRecordsMap.size} 条现有记录。开始匹配数据...`);

                const recordsToUpdate = [];
                const recordsToCreate = [];

                excelData.forEach(excelRecordRow => {
                    const excelPartNumber = excelRecordRow.fields[PART_FIELDS.number];
                    if (!excelPartNumber) {
                        console.warn('Excel中有一行缺少料号 (Part_number)，已跳过:', excelRecordRow.fields);
                        return; // 跳过没有料号的行
                    }

                    if (existingVikaRecordsMap.has(excelPartNumber)) {
                        const vikaRecord = existingVikaRecordsMap.get(excelPartNumber);
                        recordsToUpdate.push({ 
                            recordId: vikaRecord.recordId, 
                            fields: excelRecordRow.fields 
                        });
                    } else {
                        recordsToCreate.push({ fields: excelRecordRow.fields });
                    }
                });

                totalRecordsForImport = recordsToUpdate.length + recordsToCreate.length;
                if (totalRecordsForImport === 0) {
                    alert('Excel中的数据与现有记录一致，或Excel中没有可识别的备件料号。无需更新或新增。');
                    updateProgressDisplay(100, 100, '数据无需处理。');
                    // 不需要抛出错误，正常结束
                } else {
                    updateProgressDisplay(50, 100, `准备处理 ${totalRecordsForImport} 条记录 (更新: ${recordsToUpdate.length}, 新增: ${recordsToCreate.length})`);
                }
                
                let updatedCount = 0;
                let createdCount = 0;

                if (recordsToUpdate.length > 0) {
                    await updateRecordsInBatches(recordsToUpdate);
                    updatedCount = recordsToUpdate.length;
                }

                if (recordsToCreate.length > 0) {
                    await createRecordsInBatches(recordsToCreate);
                    createdCount = recordsToCreate.length;
                }
                
                if (totalRecordsForImport > 0) {
                     alert(`导入完成！共更新 ${updatedCount} 条记录，新增 ${createdCount} 条记录。`);
                }
                updateProgressDisplay(100, 100, `导入完成！更新 ${updatedCount}, 新增 ${createdCount}。`);
                loadTotalPartsCount(); // 重新加载总数

            } catch (error) {
                console.error('Excel导入过程中发生错误:', error);
                alert(`导入失败: ${error.message}`);
                updateProgressDisplay(processedRecordsCount / (totalRecordsForImport || 1) * 100, 100, `导入失败: ${error.message}`);
            } finally {
                importExcelButton.disabled = false;
                importExcelButton.textContent = originalButtonText;
                excelFileInput.value = ''; // 清空文件选择，以便用户可以再次选择相同文件
                // 进度条区域保持显示最终状态，用户可以手动关闭或页面刷新
            }
        });
    }

    // --- 辅助函数：更新进度条显示 ---
    function updateProgressDisplay(value, max, statusText) {
        let percentage = 0;
        if (max > 0) {
            percentage = Math.round((value / max) * 100);
        } else if (value === max && max === 0) { // 处理 totalRecordsForImport 为0的情况，直接100%
             percentage = 100;
        }
        
        // 如果我们是基于总记录数来计算百分比，value应该是processedRecordsCount, max应该是totalRecordsForImport
        // 但为了简化初始阶段的进度，我们可能传入0-100的value和固定的max=100
        // 因此，这里需要判断是基于固定百分比更新，还是基于实际处理数更新
        
        if (totalRecordsForImport > 0 && statusText.includes("处理中")) { // 假设 "处理中" 意味着我们在实际更新/创建阶段
            percentage = Math.round((processedRecordsCount / totalRecordsForImport) * 100);
            importProgressBar.value = processedRecordsCount;
            importProgressBar.max = totalRecordsForImport;
            importProgressPercent.textContent = `${percentage}%`;
            importStatusText.textContent = `${statusText} (${processedRecordsCount}/${totalRecordsForImport})`;
        } else { // 其他阶段，比如解析、获取数据，使用传入的value和max (通常max=100)
            importProgressBar.value = value;
            importProgressBar.max = max; // 这里的max通常是100
            importProgressPercent.textContent = `${Math.min(percentage, 100)}%`; // 确保不超过100%
            importStatusText.textContent = statusText;
        }
    }

    // --- 函数定义 --- 

    // 函数：加载并显示备件总数
    async function loadTotalPartsCount() {
        if (!totalPartsCountElement) return;
        totalPartsCountElement.textContent = '加载中...';
        const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records?viewId=viwFnt41r3C4K&fieldKey=name`;
        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${API_TOKEN}` }
            });
            if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
            const responseData = await response.json();
            if (responseData.success && responseData.data) {
                totalPartsCountElement.textContent = responseData.data.total; // API直接返回总数
            } else {
                throw new Error(responseData.message || '获取总数API业务错误');
            }
        } catch (error) {
            console.error('加载备件总数失败:', error);
            totalPartsCountElement.textContent = '获取失败';
        }
    }

    // 函数：解析Excel文件
    function parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const workbook = XLSX.read(event.target.result, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    // header: 1 表示第一行作为表头, defval: '' 表示空单元格默认值为空字符串
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }); 
                    
                    if (jsonData.length < 2) { // 至少需要表头+一行数据
                        return resolve([]);
                    }

                    // 将数组的数组转换为对象的数组，使用第一行作为对象的键
                    // 并将Excel列名映射到PART_FIELDS定义的API字段名
                    const headers = jsonData[0].map(h => String(h).trim()); // Excel表头
                    const records = [];
                    // 映射表：Excel列名 (小写) -> API字段名 (来自PART_FIELDS)
                    // 用户Excel中的列名需要能对应上，比如 "备件名称" 对应 Part_name
                    // 为了更灵活，我们可以允许用户Excel列名和PART_FIELDS中的value一致，或者key一致
                    const excelHeaderToApiFieldMap = {};
                    Object.values(PART_FIELDS).forEach(apiFieldName => {
                        excelHeaderToApiFieldMap[apiFieldName.toLowerCase()] = apiFieldName;
                    });
                    // 如果用户Excel用的是PART_FIELDS的key（如partName），也添加映射
                    Object.keys(PART_FIELDS).forEach(keyName => {
                         excelHeaderToApiFieldMap[keyName.toLowerCase()] = PART_FIELDS[keyName];
                    });

                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        const recordFields = {};
                        let hasDataInRow = false;
                        headers.forEach((header, index) => {
                            const apiField = excelHeaderToApiFieldMap[header.toLowerCase()];
                            if (apiField) {
                                let value = row[index];
                                // 特殊处理数量字段，确保是数字
                                if (apiField === PART_FIELDS.quantity) {
                                    value = parseInt(value, 10);
                                    if (isNaN(value)) value = 0; // 如果转换失败，默认为0
                                }
                                recordFields[apiField] = value;
                                if (value !== '' && value !== null && value !== undefined) {
                                    hasDataInRow = true;
                                }
                            }
                        });
                        if (hasDataInRow) { // 只添加有实际数据的行
                           records.push({ fields: recordFields });
                        }
                    }
                    resolve(records);
                } catch (e) {
                    reject(new Error('解析Excel文件失败: ' + e.message));
                }
            };
            reader.onerror = (error) => reject(new Error('读取文件失败: ' + error.message));
            reader.readAsBinaryString(file);
        });
    }

    // 新函数：获取所有维格表记录并以Part_number为键存入Map
    async function fetchAllVikaRecords(progressCallback) { // 添加了progressCallback
        const recordsMap = new Map();
        let pageNum = 1;
        const pageSize = 1000; // Vika API单次最大返回1000条
        let fetchedCount = 0;
        let estimatedTotal = pageSize; // 初始估计，如果第一页就小于pageSize，会更新

        console.log('开始获取所有现有维格表记录...');
        if (progressCallback) progressCallback({ current: 0, total: estimatedTotal, text: '开始获取维格表记录...' });

        while (true) {
            const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records?viewId=viwFnt41r3C4K&fieldKey=name&pageSize=${pageSize}&pageNum=${pageNum}`;
            console.log(`Fetching page ${pageNum} from Vika...`);
            if (progressCallback) progressCallback({ current: fetchedCount, total: estimatedTotal, text: `正在获取第 ${pageNum} 页...` });
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${API_TOKEN}` }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取维格表记录失败 (页码 ${pageNum}): ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(`获取维格表记录API业务错误 (页码 ${pageNum}): ${data.message}`);
            }
            
            const vikaRecords = data.data.records;
            fetchedCount += vikaRecords.length;
            if (pageNum === 1 && data.data.total) { // Vika有时会直接返回total
                 estimatedTotal = data.data.total;
            }


            if (vikaRecords.length === 0) {
                console.log('没有更多记录可获取。');
                if (progressCallback) progressCallback({ current: fetchedCount, total: Math.max(fetchedCount, estimatedTotal), text: '已获取所有记录。' });
                break; 
            }

            vikaRecords.forEach(record => {
                const partNumberField = PART_FIELDS.number; // 获取料号对应的字段名
                if (record.fields && record.fields[partNumberField]) {
                    recordsMap.set(record.fields[partNumberField], record); // 使用料号字段的值作为键
                } else {
                    console.warn('发现一条缺少料号的维格表记录，无法用于匹配:', record);
                }
            });

            console.log(`已获取 ${recordsMap.size} 条记录...`);
            if (progressCallback) progressCallback({ current: fetchedCount, total: Math.max(fetchedCount, estimatedTotal), text: `已获取 ${recordsMap.size} 条...` });


            if (vikaRecords.length < pageSize) {
                console.log('当前页记录数小于pageSize，判定为最后一页。');
                if (progressCallback) progressCallback({ current: fetchedCount, total: Math.max(fetchedCount, estimatedTotal), text: '已获取所有记录。' });
                break; 
            }
            pageNum++;
        }
        console.log('完成获取所有现有维格表记录。');
        return recordsMap;
    }

    // 函数：分批更新记录
    async function updateRecordsInBatches(recordsToUpdate) {
        const batchSize = 10; // 每批处理10条记录
        let currentBatchNum = 0;
        const totalBatches = Math.ceil(recordsToUpdate.length / batchSize);

        for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
            currentBatchNum++;
            const batch = recordsToUpdate.slice(i, i + batchSize);
            const recordsPayload = batch.map(record => ({
                recordId: record.recordId,
                fields: record.fields
            }));
            
            const statusMsg = `处理中 (更新): 批次 ${currentBatchNum}/${totalBatches}`;
            updateProgressDisplay(processedRecordsCount, totalRecordsForImport, statusMsg);

            console.log(`正在更新批次 ${currentBatchNum}/${totalBatches}，包含 ${batch.length} 条记录`);
            const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records`;
            try {
                const response = await fetch(apiUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ records: recordsPayload, fieldKey: "name" })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('API更新错误响应:', errorData);
                    throw new Error(`API更新失败 (批次 ${currentBatchNum}): ${response.status} - ${errorData.message || '未知错误'}`);
                }
                const responseData = await response.json();
                if (!responseData.success) {
                    console.error('API更新业务错误:', responseData);
                    throw new Error(`API更新业务错误 (批次 ${currentBatchNum}): ${responseData.message}`);
                }
                processedRecordsCount += batch.length; // 在成功后增加计数
                updateProgressDisplay(processedRecordsCount, totalRecordsForImport, statusMsg); // 更新进度条
                console.log(`批次 ${currentBatchNum}/${totalBatches} 更新成功`);
            } catch (error) {
                console.error(`更新批次 ${currentBatchNum} 失败:`, error);
                // 即使单批失败，也尝试继续处理其他批次，或者在这里决定是否中断整个流程
                // 简单起见，我们这里记录错误并继续，但可以根据需求调整为抛出错误中断整个流程
                alert(`更新批次 ${currentBatchNum} 失败: ${error.message}。部分数据可能未更新。`);
            }
            await new Promise(resolve => setTimeout(resolve, 600)); // API调用间隔
        }
    }

    // 函数：分批创建记录
    async function createRecordsInBatches(recordsToCreate) {
        const batchSize = 10; // 每批处理10条记录
        let currentBatchNum = 0;
        const totalBatches = Math.ceil(recordsToCreate.length / batchSize);

        for (let i = 0; i < recordsToCreate.length; i += batchSize) {
            currentBatchNum++;
            const batch = recordsToCreate.slice(i, i + batchSize);
            const recordsPayload = batch.map(record => ({
                fields: record.fields
            }));

            const statusMsg = `处理中 (新增): 批次 ${currentBatchNum}/${totalBatches}`;
            updateProgressDisplay(processedRecordsCount, totalRecordsForImport, statusMsg);
            
            console.log(`正在创建批次 ${currentBatchNum}/${totalBatches}，包含 ${batch.length} 条记录`);
            const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records`;
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ records: recordsPayload, fieldKey: "name" })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('API创建错误响应:', errorData);
                    throw new Error(`API创建失败 (批次 ${currentBatchNum}): ${response.status} - ${errorData.message || '未知错误'}`);
                }
                const responseData = await response.json();
                if (!responseData.success) {
                    console.error('API创建业务错误:', responseData);
                    throw new Error(`API创建业务错误 (批次 ${currentBatchNum}): ${responseData.message}`);
                }
                processedRecordsCount += batch.length; // 在成功后增加计数
                updateProgressDisplay(processedRecordsCount, totalRecordsForImport, statusMsg); // 更新进度条
                console.log(`批次 ${currentBatchNum}/${totalBatches} 创建成功`);
            } catch (error) {
                console.error(`创建批次 ${currentBatchNum} 失败:`, error);
                alert(`创建批次 ${currentBatchNum} 失败: ${error.message}。部分数据可能未创建。`);
            }
            await new Promise(resolve => setTimeout(resolve, 600)); // API调用间隔
        }
    }
}); 