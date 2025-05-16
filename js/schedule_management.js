// js/schedule_management.js - 处理排班管理页面的日历逻辑 (新风格)

// --- 配置信息 ---
const API_TOKEN = 'uskHcvUjPPwwLCVROw2N4qm'; // 复用之前定义的API Token
const SCHEDULE_DATASHEET_ID = 'dstY0gwyB5babv65kG'; // 排班数据表ID
const SCHEDULE_FIELDS = { // 维格表字段名映射
    date: 'Data',           // 日期字段
    person: 'Person',       // 人员字段
    shiftType: 'Schedule',  // 班次类型字段 (D/N)
    workHours: 'Working Hours' // 工时字段
};

// --- 更新：法定节假日数据 (根据2025年安排) ---
const STATUTORY_HOLIDAYS = [
    { date: '2025-01-01', name: '元旦' },
    { date: '2025-01-28', name: '除夕' },
    { date: '2025-01-29', name: '春节' },
    { date: '2025-01-30', name: '春节' },
    { date: '2025-01-31', name: '春节' },
    
    { date: '2025-04-04', name: '清明' },
  
    { date: '2025-05-01', name: '劳动节' },
    { date: '2025-05-02', name: '劳动节' },
    
    { date: '2025-05-31', name: '端午节' }, // 周六
    
    { date: '2025-10-01', name: '国庆节' },
    { date: '2025-10-02', name: '国庆节' },
    { date: '2025-10-03', name: '国庆节' },
    
    { date: '2025-10-06', name: '中秋节' }, // 假设中秋在国庆假期内
    
];

// --- 新增：特殊调休上班日 (这些日期即使是周末也要上班) ---
const SPECIAL_WORKDAYS = [
    '2025-01-26', // 周日，春节调休上班
    '2025-02-08', // 周六，春节调休上班
    '2025-04-27', // 周日，劳动节调休上班
    '2025-09-28', // 周日，国庆调休上班
    '2025-10-11'  // 周六，国庆调休上班
];
// --- 数据定义结束 ---

document.addEventListener('DOMContentLoaded', function() {
    // --- DOM 元素获取 ---
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');
    // const currentMonthYearSpan = document.getElementById('currentMonthYear'); // 旧的，仍会更新但主要显示由新的span负责
    const calendarDaysGrid = document.getElementById('calendarDays');
    const staffFilterSelect = document.getElementById('staffFilter');

    // 新的月份显示元素
    const chineseMonthDisplay = document.getElementById('chineseMonthDisplay');
    const englishYearMonthDisplay = document.getElementById('englishYearMonthDisplay');
    const currentMonthYearSpanOld = document.getElementById('currentMonthYear'); //用于控制行中央的年月


    // --- 全局状态 ---
    let currentDate = new Date();
    const chineseMonths = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const englishMonths = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const DAYS_IN_GRID = 42; // 6 weeks * 7 days
    let allFetchedSchedules = []; // 用于存储从API获取的原始排班数据，方便筛选
    let uniqueStaffNames = new Set(); // 用于存储不重复的人员姓名

    // --- 事件监听器 ---
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar(currentDate);
        });
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener(
            'click', () => {
                currentDate.setMonth(currentDate.getMonth() + 1);
                renderCalendar(currentDate);
            });
    }
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentDate = new Date();
            renderCalendar(currentDate);
        });
    }
    if (staffFilterSelect) {
        staffFilterSelect.addEventListener('change', () => {
            // 人员筛选变化时，不需要重新从API获取数据，直接用已有的 allFetchedSchedules 重新渲染条目
            displaySchedulesOnCalendar(allFetchedSchedules, 
                new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 26), 
                new Date(currentDate.getFullYear(), currentDate.getMonth(), 25)
            );
        });
    }

    // --- 核心函数：渲染日历 ---
    async function renderCalendar(dateToDisplay) {
        if (!calendarDaysGrid || !chineseMonthDisplay || !englishYearMonthDisplay || !currentMonthYearSpanOld) {
            console.error('日历相关的关键DOM元素未找到!');
            return;
        }

        calendarDaysGrid.innerHTML = '';
        const targetYear = dateToDisplay.getFullYear();
        const targetMonth = dateToDisplay.getMonth(); // 0-11, this is the month for which 25th is the end date

        // 更新日历头部的年月显示 (target month)
        if (chineseMonthDisplay) chineseMonthDisplay.textContent = chineseMonths[targetMonth];
        if (englishYearMonthDisplay) englishYearMonthDisplay.textContent = `${englishMonths[targetMonth]} ${targetYear}`;
        // if (currentMonthYearSpanOld) currentMonthYearSpanOld.textContent = `${targetYear}年${targetMonth + 1}月`; // 注释掉此行，不再显示顶部的年月

        // 计算视图的实际开始和结束日期 (26th of prev month to 25th of target month)
        const viewActualStartDate = new Date(targetYear, targetMonth - 1, 26);
        const viewActualEndDate = new Date(targetYear, targetMonth, 25);

        // 计算日历网格的第一个单元格应该是哪一天 (通常是某个周日)
        let firstCellDate = new Date(viewActualStartDate);
        let dayOfWeekForFirstDate = viewActualStartDate.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
        // 如果 viewActualStartDate 是周日 (0), 我们希望它成为第6列 (0-indexed), 所以要减去6天得到周一
        // 如果 viewActualStartDate 是周一 (1), 我们希望它成为第0列, 所以减去0天
        // 如果 viewActualStartDate 是周六 (6), 我们希望它成为第5列, 所以减去5天
        let daysToSubtract = (dayOfWeekForFirstDate === 0) ? 6 : dayOfWeekForFirstDate - 1;
        firstCellDate.setDate(firstCellDate.getDate() - daysToSubtract);

        // 渲染网格单元格
        for (let i = 0; i < DAYS_IN_GRID; i++) {
            let cellDate = new Date(firstCellDate);
            cellDate.setDate(firstCellDate.getDate() + i);

            // 判断此单元格日期是否在有效的26-25显示范围内
            const isEffectivelyOutOfView = cellDate < viewActualStartDate || cellDate > viewActualEndDate;
            
            const dayCell = createDayCell(cellDate, isEffectivelyOutOfView);
            calendarDaysGrid.appendChild(dayCell);
        }
        
        // 获取原始排班数据
        allFetchedSchedules = await fetchRawSchedulesForPeriod(targetYear, targetMonth);
        console.log(`API 获取到 ${allFetchedSchedules.length} 条原始记录 (去重前)`); // 添加日志，显示去重前的数量

        // --- 新增：根据 recordId 去重 ---
        // 维格表API返回的每条记录都有一个唯一的 'recordId' 字段
        const uniqueRecordsMap = new Map();
        allFetchedSchedules.forEach(record => {
            uniqueRecordsMap.set(record.recordId, record); // 使用 recordId 作为键，确保记录的唯一性
        });
        allFetchedSchedules = Array.from(uniqueRecordsMap.values());
        console.log(`去重后剩余 ${allFetchedSchedules.length} 条排班记录。`); // 添加日志，显示去重后的数量

        uniqueStaffNames.clear(); // 清空之前的人员列表
        allFetchedSchedules.forEach(record => {
            if (record.fields[SCHEDULE_FIELDS.person]) {
                uniqueStaffNames.add(record.fields[SCHEDULE_FIELDS.person]);
            }
        });
        populateStaffFilter(uniqueStaffNames);
        // 在日历上显示处理过的排班数据
        displaySchedulesOnCalendar(allFetchedSchedules, viewActualStartDate, viewActualEndDate);
    }

    // --- 辅助函数：创建日期单元格 ---
    function createDayCell(date, isEffectivelyOutOfView) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        
        const dayNumberSpan = document.createElement('span');
        dayNumberSpan.classList.add('day-number');
        dayNumberSpan.textContent = date.getDate();
        dayCell.appendChild(dayNumberSpan);

        // const dateString = date.toISOString().split('T')[0]; // 格式 YYYY-MM-DD // 注释掉旧的转换方式

        // --- 新增：使用本地日期生成 YYYY-MM-DD 格式字符串 ---
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份是0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const localDateString = `${year}-${month}-${day}`; // 用于比较和data-date属性
        // --- 本地日期字符串生成完毕 ---

        // 核心：确保 isEffectivelyOutOfView 为 true 时，添加 not-current-month 类
        if (isEffectivelyOutOfView) {
            dayCell.classList.add('not-current-month');
        }

        // 检查并标记法定节假日 (优先)
        const holiday = STATUTORY_HOLIDAYS.find(h => h.date === localDateString); // 使用 localDateString
        if (holiday) { // 如果是法定节假日
            dayCell.classList.add('statutory-holiday');
            // 只有在当前视图内的节假日才显示名称，避免非当前月份格子文字过多
            if (!isEffectivelyOutOfView) { 
                const holidayNameSpan = document.createElement('span');
                holidayNameSpan.classList.add('holiday-name');
                holidayNameSpan.textContent = holiday.name;
                dayCell.appendChild(holidayNameSpan);
            }
        } else { // 如果不是法定节假日，再检查是否为特殊上班的周末或普通周末
            const isSpecialWorkday = SPECIAL_WORKDAYS.includes(localDateString); // 使用 localDateString
            if (isSpecialWorkday) {
                // 特殊上班日，不添加 weekend-day 类，表现为普通工作日（白色背景）
                // 如果需要特殊标记（例如不同于普通工作日的颜色），可以在这里添加特定类
                dayCell.classList.add('special-workday'); // 可选：添加此类用于特殊样式
            } else {
                // 不是特殊上班日，再判断是否为普通周末
                const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    dayCell.classList.add('weekend-day'); // 普通周末，黄色背景
                }
            }
        }

        // 标记今天的日期 (这个标记可以覆盖其他背景色，如果CSS中.today有背景色的话)
        const today = new Date();
        if (date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()) {
            dayCell.classList.add('today');
        }
        
        // 只有在有效视图范围内的日期才设置 data-date 用于排班匹配
        if (!isEffectivelyOutOfView) {
            dayCell.dataset.date = localDateString; // 使用 localDateString
        }

        const entriesContainer = document.createElement('div');
        entriesContainer.classList.add('schedule-entries-container');
        dayCell.appendChild(entriesContainer);

        return dayCell;
    }

    // --- 函数：获取指定月份及上一个月的原始排班数据 ---
    async function fetchRawSchedulesForPeriod(targetYear, targetMonth) {
        console.log(`正在获取 ${targetYear}年${targetMonth + 1}月 及上一个月的排班数据...`);
        let records = [];
        // 获取目标月份和上一个月的数据
        const monthsToFetch = [
            { year: targetYear, month: targetMonth },
            { year: targetMonth === 0 ? targetYear - 1 : targetYear, month: targetMonth === 0 ? 11 : targetMonth - 1 }
        ];

        for (const m of monthsToFetch) {
            let pageNum = 1;
            const pageSize = 1000; // Vika API限制
            while (true) {
                // 注意：维格表的月份筛选通常需要特定格式或使用其日期函数，这里简化为获取整月数据
                // 一个更精确的方式可能是通过filterByFormula，但这依赖于日期字段的格式
                // 为简单起见，我们获取整个月，然后客户端过滤。或者，如果知道日期字段是YYYY-MM-DD格式，可以用starts with
                // const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${SCHEDULE_DATASHEET_ID}/records?viewId=viwXXXX&fieldKey=name&pageSize=${pageSize}&pageNum=${pageNum}&filterByFormula=AND({${SCHEDULE_FIELDS.date}}>=DATETIME_PARSE("${m.year}-${String(m.month+1).padStart(2,'0')}-01"),{${SCHEDULE_FIELDS.date}}<=DATETIME_PARSE("${m.year}-${String(m.month+1).padStart(2,'0')}-${new Date(m.year, m.month+1,0).getDate()}"))`;
                // 上述filterByFormula需要用户确保日期字段是日期类型。如果只是文本，筛选更复杂。
                // 暂时我们获取记录时不按月份严格筛选，而是依赖后续的JS日期范围判断
                // 后续优化：如果数据量大，应实现更精确的API级别月份筛选
                const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${SCHEDULE_DATASHEET_ID}/records?fieldKey=name&pageSize=${pageSize}&pageNum=${pageNum}`;
                console.log(`Fetching from API: ${apiUrl}`);
                try {
                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`API请求失败 (状态 ${response.status}): ${errorText}`);
                        throw new Error(`API请求失败 (月份 ${m.month + 1}): ${response.status}`);
                    }
                    const data = await response.json();
                    if (!data.success) {
                        console.error('API业务错误:', data.message);
                        throw new Error(`API业务错误 (月份 ${m.month + 1}): ${data.message}`);
                    }
                    records.push(...data.data.records);
                    if (data.data.records.length < pageSize) {
                        break; // 到达最后一页
                    }
                    pageNum++;
                } catch (error) {
                    console.error('获取排班数据时出错:', error);
                    alert(`获取排班数据失败: ${error.message}`);
                    return []; // 返回空数组表示失败
                }
            }
        }
        console.log(`共获取 ${records.length} 条原始排班记录。`);
        return records;
    }

    // --- 辅助函数：计算班次起止时间 ---
    function calculateShiftDisplayTime(shiftType, workHours) {
        let startTimeHour, startTimeMinute;
        if (shiftType === 'D') { // 白班
            startTimeHour = 8;
            startTimeMinute = 30;
        } else if (shiftType === 'N') { // 夜班
            startTimeHour = 20;
            startTimeMinute = 30;
        } else {
            return '未知班次';
        }

        let mealBreakHours = 0; // 初始化用餐时间为0小时
        // 根据工时确定用餐时间
        if (workHours === 8) {
            mealBreakHours = 0.5; // 8小时工作，增加0.5小时用餐时间
        } else if (workHours === 11) {
            mealBreakHours = 1.0; // 11小时工作，增加1小时用餐时间 (2次0.5小时)
        }
        // 对于其他工时，目前不额外增加用餐时间，除非有进一步说明

        const totalDurationHours = workHours + mealBreakHours; // 计算总时长（工作时长 + 用餐时长）

        const startDate = new Date(2000, 0, 1, startTimeHour, startTimeMinute); // 用一个固定日期进行时间计算
        // 使用总时长来计算结束时间
        const endDate = new Date(startDate.getTime() + totalDurationHours * 60 * 60 * 1000);

        const formatTime = (dateObj) => `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        return `${formatTime(startDate)}-${formatTime(endDate)}`;
    }

    // --- 函数：将处理后的排班数据展示在日历上 ---
    function displaySchedulesOnCalendar(schedulesData, viewStartDate, viewEndDate) {
        // 清空现有日历上的所有排班条目
        document.querySelectorAll('.calendar-day .schedule-entries-container').forEach(container => container.innerHTML = '');

        const selectedStaff = staffFilterSelect.value;

        schedulesData.forEach(record => {
            const fields = record.fields;
            const scheduleDateStr = fields[SCHEDULE_FIELDS.date];

            // --- 新增：处理软删除的记录 ---
            // 检查 'Schedule' (班次类型) 字段是否为 'Deleted'
            const shiftTypeValue = fields[SCHEDULE_FIELDS.shiftType];
            if (shiftTypeValue === 'Deleted') {
                // 如果是软删除的记录，则跳过，不进行显示
                // console.log('跳过已软删除的排班记录:', record.recordId, fields); // 可选：取消注释以进行调试
                return; 
            }
            // --- 软删除记录处理完毕 ---

            if (!scheduleDateStr) return; // 跳过没有日期的记录

            // 维格表返回的日期可能是时间戳或YYYY-MM-DD字符串，需要适配
            // 假设 scheduleDateStr 是 YYYY-MM-DD 格式或可以被 new Date() 解析的格式
            const scheduleDate = new Date(scheduleDateStr);
             // 修正：确保比较时忽略时间部分，仅比较日期
            scheduleDate.setHours(0, 0, 0, 0);
            const compareViewStartDate = new Date(viewStartDate); compareViewStartDate.setHours(0,0,0,0);
            const compareViewEndDate = new Date(viewEndDate); compareViewEndDate.setHours(0,0,0,0);

            if (scheduleDate < compareViewStartDate || scheduleDate > compareViewEndDate) {
                return; // 不在当前视图范围内
            }

            const personName = fields[SCHEDULE_FIELDS.person];
            if (selectedStaff !== 'all' && personName !== selectedStaff) {
                return; // 按人员筛选
            }

            const shiftCode = shiftTypeValue; // 'D' or 'N' - 使用已经获取并判断过的 shiftTypeValue
            const workHours = parseFloat(fields[SCHEDULE_FIELDS.workHours]);

            if (!personName || !shiftCode || isNaN(workHours)) {
                console.warn('排班记录字段不完整或工时无效:', fields);
                return; // 跳过不完整记录
            }

            const shiftTimeDisplay = calculateShiftDisplayTime(shiftCode, workHours);
            const shiftTypeClass = shiftCode === 'D' ? 'day-shift' : (shiftCode === 'N' ? 'night-shift' : '');

            // const dateForCell = scheduleDate.toISOString().split('T')[0]; // 旧的获取方式
            // --- 新增：同样使用本地日期方法生成比较字符串 ---
            const schYear = scheduleDate.getFullYear();
            const schMonth = String(scheduleDate.getMonth() + 1).padStart(2, '0');
            const schDay = String(scheduleDate.getDate()).padStart(2, '0');
            const dateForCell = `${schYear}-${schMonth}-${schDay}`;
            // --- 生成完毕 ---
            
            const dayCell = calendarDaysGrid.querySelector(`.calendar-day[data-date='${dateForCell}']`);

            if (dayCell) {
                const entriesContainer = dayCell.querySelector('.schedule-entries-container');
                if (entriesContainer) {
                    const scheduleDiv = document.createElement('div');
                    scheduleDiv.classList.add('schedule-entry');
                    if (shiftTypeClass) scheduleDiv.classList.add(shiftTypeClass);
                    
                    // --- 新增：创建内部span用于分别显示人名和时间 ---
                    const nameSpan = document.createElement('span');
                    nameSpan.classList.add('entry-person-name');
                    nameSpan.textContent = personName;

                    const timeSpan = document.createElement('span');
                    timeSpan.classList.add('entry-shift-time');
                    timeSpan.textContent = shiftTimeDisplay;

                    scheduleDiv.appendChild(nameSpan);
                    scheduleDiv.appendChild(timeSpan);
                    scheduleDiv.title = `${personName} ${shiftTimeDisplay}`; // title 保持不变，用于鼠标悬浮提示
                    // --- 内部span创建完毕 ---
                    
                    // --- 修改：确保夜班条目在白班条目下方 ---
                    if (shiftTypeClass === 'night-shift') {
                        entriesContainer.appendChild(scheduleDiv); // 夜班直接追加到末尾
                    } else {
                        // 白班需要插入到所有已存在的夜班条目之前
                        const firstNightShiftEntry = entriesContainer.querySelector('.schedule-entry.night-shift');
                        if (firstNightShiftEntry) {
                            entriesContainer.insertBefore(scheduleDiv, firstNightShiftEntry);
                        } else {
                            entriesContainer.appendChild(scheduleDiv); // 如果没有夜班，白班也追加到末尾
                        }
                    }
                }
            }
        });
    }

    // --- 辅助函数：填充人员筛选下拉框 ---
    function populateStaffFilter(staffSet) {
        const currentFilterValue = staffFilterSelect.value;
        staffFilterSelect.innerHTML = '<option value="all">全部</option>'; // 重置并保留"全部"
        const sortedNames = Array.from(staffSet).sort();
        sortedNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            staffFilterSelect.appendChild(option);
        });
        // 尝试恢复之前的筛选值
        if (Array.from(staffFilterSelect.options).some(opt => opt.value === currentFilterValue)) {
             staffFilterSelect.value = currentFilterValue;
        } else {
             staffFilterSelect.value = 'all'; // 如果旧值不在新列表，则重置为all
        }
    }

    // --- 初始化日历 ---
    renderCalendar(currentDate);
}); 