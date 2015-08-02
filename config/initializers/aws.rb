AWS.config(
  access_key_id: ENV["AWS_ACCESS_KEY"],
  secret_access_key: ENV["AWS_SECRET_ACCESS"]
)
S3_BUCKET =  AWS::S3.new.buckets['while_true']

AWS_CONFIG = {
  'access_key_id' => ENV["AWS_ACCESS_KEY"],
  'secret_access_key' => ENV["AWS_SECRET_ACCESS"],
  'bucket' => 'while_true',
  'acl' => 'public-read',
  'key_start' => 'post_uploads/'
}