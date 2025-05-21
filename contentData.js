const axios = require('axios');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
require('dotenv').config();

const COURSE_SEARCH_URL = 'https://nulp.niua.org/api/content/v1/search';
const BATCH_LIST_URL = 'https://nulp.niua.org/api/course/v1/batch/list';

const csvWriter = createObjectCsvWriter({
  path: 'courses.csv',
  header: [
    { id: 'do_id', title: 'DO_ID' },
    { id: 'course_name', title: 'Course Name' },
    { id: 'created_on', title: 'Date of Creation' },
    { id: 'org_name', title: 'Organisation Name' },
    { id: 'cert_course', title: 'Certificate Course (Y/N)' },
    { id: 'status', title: 'Status' },
    { id: 'batch_count', title: 'Batch Count' },
    { id: 'all_batch_ids', title: 'All Batch IDs' }
  ]
});

async function fetchCourses() {
  try {
    const response = await axios.post(COURSE_SEARCH_URL, {
      request: {
        filters: {
          primaryCategory: 'Course',
          status: [],
          identifier: []
        },
        fields: ['name', 'status', 'identifier', 'organisation', 'createdOn', 'batches'],
        limit: 10000,
        facets: ['createdBy']
      }
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return response.data.result.content || [];
  } catch (error) {
    console.error('Error fetching courses:', error.message);
    return [];
  }
}

async function isCertificateCourse(batchId) {
    console.log(`Checking certificate for batchId: ${batchId}`);
  try {
    const response = await axios.post(BATCH_LIST_URL, {
      request: {
        filters: { batchId: [batchId] },
        limit: 1
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,
        'x-authenticated-user-token': process.env.USER_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Response for batchId ${batchId}:`, response.data);

    const batch = response.data.result.response?.content?.[0];
    console.log(`Batch details for ${batchId}:`, batch);
    console.log(`Batch certTemplates details for ${batchId}:`, batch.certTemplates);
    return batch && batch.certTemplates ? 'Y' : 'N';
  } catch (error) {
    console.warn(`Error checking certificate for batchId ${batchId}:`, 
      error.response?.status || '', 
      error.response?.data?.message || error.message);
    return 'N';
  }
}

(async () => {
  const courses = await fetchCourses();

  const records = await Promise.all(courses.map(async (course) => {
    const batchArray = course.batches || [];
    const batchIds = batchArray.map(batch => batch.batchId).filter(Boolean);
    const batchCount = batchIds.length;
    const firstBatchId = batchIds[0];

    const certCourse = firstBatchId ? await isCertificateCourse(firstBatchId) : 'N';

    return {
      do_id: course.identifier || '',
      course_name: course.name?.trim() || '',
      created_on: course.createdOn ? new Date(course.createdOn).toISOString().split('T')[0] : '',
      org_name: course.organisation?.[0] || '',
      cert_course: certCourse,
      status: course.status || '',
      batch_count: batchCount,
      //all_batch_ids: batchIds.join(', ')
      all_batch_ids: batchIds.map(id => `'${id}'`).join(', ')
    };
  }));

  await csvWriter.writeRecords(records);
  console.log('✅ CSV file "courses.csv" has been created with batch details.');
})();
